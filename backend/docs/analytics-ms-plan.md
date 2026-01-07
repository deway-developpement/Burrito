# Analytics Microservice Plan

This document specifies the analytics microservice that aggregates evaluations for a form, produces graph-ready data, and optionally enriches open-ended answers via the intelligence microservice.

## Scope

- Aggregate evaluation data per form (overall + per question).
- Support 1–10 rating scale with NPS-style buckets.
- Provide chart-ready outputs for dashboards.
- Cache snapshots for fast reads; refresh on demand or via events.
- Optionally call intelligence ms for open-text insights.

Non-goals:
- Do not replace evaluations/forms storage.
- Do not require synchronous intelligence processing for every request.

## Data Sources

- Forms ms: form definition and question types.
  - `form.getById` or `form.query`
- Evaluations ms: responses for a given form.
  - `evaluation.query` or `evaluation.aggregate`
- Intelligence ms: sentiment and idea extraction for text answers (optional).
  - gRPC client using `apps/intelligence-ms/proto/analytics.proto`

## Rating Scale + NPS

- Rating scale is 1–10.
- NPS buckets:
  - Detractors: 1–6
  - Passives: 7–8
  - Promoters: 9–10
- NPS score: `%Promoters - %Detractors`

## Chart Proposition (per form)

- Overall NPS score (gauge or big number).
- NPS distribution (stacked bar: promoters/passives/detractors).
- Average rating per question (horizontal bar).
- Rating distribution per question (histogram 1–10 or bucketed).
- Response volume over time (line: daily/weekly counts).
- Participation by question (answered count / total responses).
- Open-text insights per question (top themes + sentiment split).

## Snapshot Data Shape (proposal)

```ts
type AnalyticsSnapshot = {
  formId: string;
  window: { from?: Date; to?: Date };
  generatedAt: Date;
  staleAt: Date;
  totalResponses: number;
  nps: {
    score: number;
    promotersPct: number;
    passivesPct: number;
    detractorsPct: number;
    promotersCount: number;
    passivesCount: number;
    detractorsCount: number;
  };
  questions: Array<{
    questionId: string;
    label: string;
    type: 'RATING' | 'TEXT';
    answeredCount: number;
    rating?: {
      avg: number;
      median: number;
      min: number;
      max: number;
      distribution: Record<number, number>; // 1..10 counts
      npsBuckets: {
        promotersCount: number;
        passivesCount: number;
        detractorsCount: number;
        promotersPct: number;
        passivesPct: number;
        detractorsPct: number;
      };
    };
    text?: {
      responseCount: number;
      topIdeas: Array<{ idea: string; count: number }>;
      sentiment?: {
        positivePct: number;
        neutralPct: number;
        negativePct: number;
      };
    };
  }>;
  timeSeries: Array<{
    bucketStart: Date;
    count: number;
  }>;
};
```

## Aggregation Rules

- Per question:
  - **Rating**: use `rating` values only; ignore missing ratings.
  - **Text**: count non-empty `text` answers; optionally call intelligence ms.
- Overall:
  - `totalResponses = evaluations.length`.
  - Overall NPS computed from all rating answers across all rating questions.
- Time series:
  - Bucket by day or week based on window size.
  - Use `Evaluation.createdAt` for counts.
  - Default window is all-time (no `from`/`to` constraints).

## Caching Strategy

- Store snapshots in MongoDB (`analytics_snapshots` collection).
- Keyed by `{ formId, window.from, window.to }`.
- TTL via `staleAt` index.
- Refresh policy:
  - On read: if snapshot is missing or stale, recompute and upsert.
  - On write: when evaluations are created, publish an event (future) to invalidate or refresh.

## API Contracts (Message Patterns)

Suggested Redis patterns for analytics ms:

- `analytics.getFormSnapshot`
  - Input: `{ formId: string; window?: { from?: Date; to?: Date } }`
  - Output: `AnalyticsSnapshot`
- `analytics.refreshSnapshot`
  - Input: same as above
  - Output: `AnalyticsSnapshot`

Optional:
- `analytics.getQuestionBreakdown`
- `analytics.getTimeSeries`

## Intelligence Enrichment Constraints

- Default behavior is async and non-blocking; never hold snapshot generation on intelligence calls.
- Store enrichment separately or as a subdocument with `analysisStatus` and `lastEnrichedAt`.
- Use timeouts + circuit breaker; return partial data if intelligence is unavailable.
- Allow an explicit `forceSync` flag for admin/preview only.
- Avoid reprocessing unchanged text by tracking a content hash per question.

## Implementation Plan

1. **Create analytics ms skeleton**
   - `apps/analytics-ms` with module, controller, service.
   - Redis transport setup (same as other ms).
   - Logger + Prometheus + config modules.
2. **Define data models**
   - Mongoose schema for `AnalyticsSnapshot`.
   - Add indexes for `formId` and `staleAt`.
3. **Add inter-service clients**
   - ClientProxy for forms ms + evaluations ms.
   - gRPC client for intelligence ms (optional, behind feature flag).
4. **Implement aggregation service**
   - Fetch form + evaluations.
   - Build per-question stats (rating + text).
   - Compute NPS and time series.
   - Store and return snapshot.
5. **Add caching logic**
   - Read snapshot by key.
   - If stale or missing, rebuild and upsert.
6. **Expose message patterns**
   - `analytics.getFormSnapshot`
   - `analytics.refreshSnapshot`
7. **Testing**
   - Unit tests for aggregation functions and NPS bucket logic.
   - Integration test with mocked forms/evaluations clients.
   - Optional gRPC stub test for intelligence.
8. **Observability + resiliency**
   - Log aggregation latency and upstream failures.
   - Add timeouts for downstream calls and return partial data when intelligence is unavailable.

## Environment Variables

- `REDIS_HOST`, `REDIS_PORT`
- `MONGODB_*` (same as forms/evaluations ms)
- `ANALYTICS_SNAPSHOT_TTL_SECONDS`
- `ANALYTICS_TIME_BUCKET` (day/week)
- `INTELLIGENCE_GRPC_HOST`, `INTELLIGENCE_GRPC_PORT`
- `ANALYTICS_ENABLE_INTELLIGENCE` (true/false)

## Open Decisions

- Choose the async enrichment mechanism (event-driven vs scheduled refresh).
