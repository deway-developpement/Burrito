# Analytics Text Analysis Subscription Plan

## Scope
- Add a GraphQL subscription that streams per-question text analysis status updates.
- Only emit updates for async text analysis transitions (PENDING, READY, FAILED).
- Support multiple API gateway instances (shared Redis pubsub).

## Requirements (confirmed)
- Subscription payload is per-question delta, not the full snapshot.
- Multiple API gateway instances are running.
- Only this subscription is needed, only for text analysis status updates.

## Proposed payload
- Event name (Redis + GraphQL): `analytics.textAnalysisStatusChanged`
- Payload shape (per-question delta):
  - `formId: string`
  - `questionId: string`
  - `windowKey: string`
  - `window?: { from?: Date; to?: Date }` (optional but recommended to target the right snapshot)
  - `analysisStatus: PENDING | READY | FAILED | DISABLED`
  - `analysisHash?: string`
  - `analysisError?: string`
  - `lastEnrichedAt?: Date`
  - `topIdeas?: Array<{ idea: string; count: number }>`
  - `sentiment?: { positivePct: number; neutralPct: number; negativePct: number }`

## Backend plan

### 1) Emit status-change events from analytics-ms
Files:
- `backend/apps/analytics-ms/src/analytics/analytics.service.ts`
- `backend/apps/analytics-ms/src/analytics-ms.module.ts`

Steps:
1. Add a Redis client in `analytics-ms.module.ts` (via `ClientsModule.registerAsync`) for event emission, for example `ANALYTICS_EVENTS`.
2. Inject the client into `AnalyticsService`.
3. Add a helper `emitTextAnalysisStatusChanged(payload)` that calls `client.emit(...)`.
4. Trigger emission only when status changes in the async flow:
   - After setting PENDING in `markEnrichmentPending` and the in-loop pending update in `enrichSnapshot`.
   - After setting FAILED in `markTextEnrichmentFailed`.
   - After setting READY on success (the update that writes `topIdeas`, `sentiment`, `lastEnrichedAt`).
5. Include `formId`, `questionId`, and `windowKey` in every payload. These values exist on the snapshot and are needed for filtering on the client.
6. For READY events, include full text details (`topIdeas`, `sentiment`, `lastEnrichedAt`, optional `analysisError`) alongside status/hash.

Notes:
- Avoid emitting for the initial snapshot build; only emit when async updates occur.
- If needed, compare current question text status before emitting to reduce duplicates.

### 2) Bridge Redis events to GraphQL subscriptions in the API gateway
Files:
- `backend/apps/api-gateway/src/main.ts`
- `backend/apps/api-gateway/src/api-gateway.module.ts`
- `backend/apps/api-gateway/src/analytics/analytics.module.ts`
- `backend/apps/api-gateway/src/analytics/analytics.resolver.ts`
- `backend/apps/api-gateway/src/analytics/dto/analytics-snapshot.dto.ts`

Steps:
1. Connect the API gateway to Redis as a microservice to receive events:
   - In `main.ts`, call `app.connectMicroservice<MicroserviceOptions>({ transport: Transport.REDIS, options: { host, port } })`
   - Start the microservice with `app.startAllMicroservices()`.
2. Add an event handler (controller or service) that listens to
   `@EventPattern('analytics.textAnalysisStatusChanged')` and publishes to GraphQL pubsub.
3. Use Redis-backed pubsub because there are multiple gateways:
   - Add `graphql-redis-subscriptions` and configure a `RedisPubSub` provider.
   - Share Redis host/port with existing env vars.
4. Add a subscription resolver:
   - `@Subscription(() => AnalyticsTextAnalysisUpdateDto, { filter })`
   - Filter by `formId` and `windowKey` (preferred) to match the active view.
   - Guard with `GqlCredentialGuard(UserType.TEACHER|ADMIN)` to match existing analytics access.
5. Add DTO(s) for the per-question delta payload:
   - New `AnalyticsTextAnalysisUpdateDto` in `analytics-snapshot.dto.ts`.
   - Reuse `TextIdeaDto`, `SentimentStatsDto`, and `TextAnalysisStatus`.

### 3) Enable GraphQL WS auth
Files:
- `backend/apps/api-gateway/src/api-gateway.module.ts`
- `backend/apps/api-gateway/src/auth/guards/graphql-auth.guard.ts`

Steps:
1. Enable `graphql-ws` in `GraphQLModule.forRoot`:
   - Add `subscriptions: { 'graphql-ws': { onConnect: (...) => ... } }`.
2. In `onConnect`, map `connectionParams.Authorization` or `connectionParams.authorization`
   into a request-like context so the existing JWT guards read it as `req.headers.authorization`.
3. Ensure both HTTP and WS contexts are supported by the guard (no guard changes if the context shape matches).

## Frontend plan

### 1) Apollo GraphQL WS link
Files:
- `burrito-front/src/app/app.config.ts`

Steps:
1. Add dependency `graphql-ws`.
2. Create a `GraphQLWsLink` in the browser only.
3. Use `split` with `getMainDefinition` to route subscriptions over WS and queries/mutations over HTTP.
4. Provide auth token via `connectionParams` (read from `AuthService.token()`).

### 2) Subscribe in the form results page
Files:
- `burrito-front/src/app/pages/results-form/results-form.component.ts`

Steps:
1. Add a subscription query:
   - `analyticsTextAnalysisStatusChanged(formId: $formId, window: $window)`
   - returns the per-question delta fields.
2. Start the subscription after the initial analytics snapshot loads.
3. On each event:
   - Locate the question by `questionId` in `analytics().questions`.
   - Update only the `text` fields (status, hash, error, sentiment, topIdeas, lastEnrichedAt).
4. Unsubscribe on destroy, and re-subscribe if the window changes.

## Rollout and validation
- Local test:
  - Start Redis, analytics-ms, api-gateway, frontend.
  - Trigger text analysis (enable intelligence, submit responses).
  - Confirm status transitions appear in the UI without a refresh.
- Multi-gateway test:
  - Run two API gateways and verify subscriptions work on both.
- Infra:
  - Ensure load balancer supports WebSocket upgrades on `/graphQL`.

## Decision notes
- Use `windowKey` as the primary filter to avoid `Date` equality issues; expose `window` for convenience and compute `windowKey` server-side if provided.
- READY events include full text details (topIdeas, sentiment, lastEnrichedAt).
