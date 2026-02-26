# Intelligence Migration Runbook (Python gRPC -> Rust Knative)

## Scope
This runbook covers direct cutover to the Rust intelligence function, Redis stream flow, and rollback.

## New Runtime Topology
`analytics-ms -> Redis Stream (request) -> RedisStreamSource -> intelligence-fn-rs (Knative Service) -> Redis Stream (result) -> analytics-ms consumer`

## Required Streams
- Request: `analytics:intelligence:request:v1`
- Result: `analytics:intelligence:result:v1`
- DLQ: `analytics:intelligence:dlq:v1`

## Preconditions
1. Knative Serving CRD exists: `services.serving.knative.dev`
2. Knative Redis source CRD exists: `redisstreamsources.sources.knative.dev`
3. `backend/k8s/evaluation-system.yaml` and `backend/k8s/intelligence-fn-rs.knative.yaml` are applied.

## Cutover Steps
1. Build and push backend images and `burrito-intelligence-fn-rs` image.
2. Apply manifests:
   - `backend/k8s/evaluation-system.yaml`
   - `backend/k8s/intelligence-fn-rs.knative.yaml`
3. Verify Knative service readiness:
   - `kubectl -n evaluation-system wait --for=condition=Ready kservice/intelligence-fn-rs --timeout=5m`
4. Verify Redis source readiness:
   - `kubectl -n evaluation-system get redisstreamsource intelligence-request-source -o yaml`
5. Trigger text analysis and verify status transitions `PENDING -> READY`.

## Validation Gates
- `analytics-ms` logs show request enqueue and result processing.
- `analytics.textAnalysisStatusChanged` still emits expected payloads.
- Result stream lag remains near zero under nominal traffic.
- DLQ stream remains empty or near-zero.

## DLQ Replay
1. Inspect DLQ entries:
   - `XRANGE analytics:intelligence:dlq:v1 - + COUNT 100`
2. Parse and validate `payload` and failure reason.
3. Requeue valid payloads manually into request stream:
   - `XADD analytics:intelligence:request:v1 * payload '<json>'`
4. Remove replayed DLQ messages only after successful processing verification.

## Rollback
1. Revert this PR.
2. Re-apply previous manifests.
3. Redeploy previous images.
4. Verify Python `intelligence-ms` deployment and gRPC path are healthy.

## Observability Checklist
- Request stream depth
- Result stream depth
- DLQ depth
- Timeout-to-failed ratio
- End-to-end enrichment latency (`PENDING` to `READY`)
