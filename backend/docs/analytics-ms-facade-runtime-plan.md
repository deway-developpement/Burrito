# Analytics GraphQL Facade + Runtime Wiring Plan

This plan covers the GraphQL facade in the API Gateway for the analytics microservice, plus Docker and Kubernetes wiring.

## Goals

- Expose analytics snapshots via GraphQL from the API Gateway.
- Keep the gateway as the single public API surface.
- Wire analytics-ms into Docker Compose and Kubernetes runtime.

## GraphQL Facade (API Gateway)

### Module + Client

1. Add `apps/api-gateway/src/analytics/analytics.module.ts`.
2. Register a Redis client:
   - `ClientsModule.registerAsync` with `name: 'ANALYTICS_SERVICE'`.
3. Import `AnalyticsModule` into `apps/api-gateway/src/api-gateway.module.ts`.

### Service

1. Add `apps/api-gateway/src/analytics/analytics.service.ts`.
2. Use the `ClientProxy` pattern with timeout handling (same as `EvaluationService`).
3. Implement calls:
   - `analytics.getFormSnapshot`
   - `analytics.refreshSnapshot`

### GraphQL Types + Inputs

Create DTOs in `apps/api-gateway/src/analytics/dto/`:

- `AnalyticsSnapshotDto`
- `AnalyticsWindowInput` (optional `from`, `to`)
- `NpsSummaryDto`
- `QuestionAnalyticsDto`
- `RatingStatsDto`
- `TextStatsDto`
- `TextIdeaDto`
- `TimeBucketDto`
- `NpsBucketsDto`
- `TextAnalysisStatus` enum

Notes:
- GraphQL does not support Map types. Convert the rating `distribution` to a list of buckets:
  - `RatingBucketDto { rating: Int, count: Int }`
- Expose `analysisStatus`, `analysisError`, and `lastEnrichedAt` for text analytics.

### Resolvers

Add `apps/api-gateway/src/analytics/analytics.resolver.ts`:

- `analyticsSnapshot(formId: String!, window: AnalyticsWindowInput, forceSync: Boolean)`
- `refreshAnalyticsSnapshot(formId: String!, window: AnalyticsWindowInput, forceSync: Boolean)`

Guards:
- Apply `GqlAuthGuard` + role checks (Teacher/Admin) like existing forms/evaluations resolvers.

### Date Handling

The analytics snapshot includes `generatedAt`, `staleAt`, `bucketStart`, `lastEnrichedAt`, and `window` dates.

Options:
- Extend `TimestampToDateInterceptor` to convert these keys.
- Or define explicit GraphQL Date scalars and map directly.

## Docker Compose Wiring

Update `docker-compose.yml`:

- Add service `analytics-ms`:
  - `build.context: .`
  - `build.args: SERVICE_NAME=analytics-ms`
  - Env: Mongo + Redis (same as other ms)
  - Mount `.env` read-only
- Add `analytics-ms` to `api-gateway` `depends_on` (optional but recommended for local dev).
- If using intelligence enrichment in Docker:
  - `INTELLIGENCE_GRPC_HOST=intelligence-ms`
  - `INTELLIGENCE_GRPC_PORT=50051`
  - `ANALYTICS_ENABLE_INTELLIGENCE=true`

## Kubernetes Wiring

Update `k8s/evaluation-system.yaml` (and `evaluation-system.local.yaml` if used):

1. Add `analytics-ms` Deployment:
   - Image: `burrito-analytics-ms:latest`
   - Env from `burrito-config` + `burrito-secrets`
   - `ANALYTICS_*` env vars (TTL, time bucket, enrichment flags)
   - Optional `INTELLIGENCE_GRPC_HOST=intelligence-ms`
2. Add `analytics-ms` Service:
   - Port `3000` for metrics (consistent with other ms)
3. Add Prometheus scrape annotations.

## Configuration

Add these env vars where appropriate:

- `ANALYTICS_SNAPSHOT_TTL_SECONDS`
- `ANALYTICS_TIME_BUCKET` (day/week)
- `ANALYTICS_ENABLE_INTELLIGENCE`
- `ANALYTICS_INTELLIGENCE_TIMEOUT_MS`
- `INTELLIGENCE_GRPC_HOST`
- `INTELLIGENCE_GRPC_PORT`

## Validation Steps

- GraphQL query from gateway:
  - `analyticsSnapshot(formId: "...")`
- Confirm cached vs refreshed responses.
- If intelligence enabled, verify `analysisStatus` transitions.
- Ensure K8s and Docker services start and can reach Redis + Mongo.
