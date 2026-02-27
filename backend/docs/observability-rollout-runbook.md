# Observability Rollout Runbook (OTel + Tempo)

## Objective

Deploy end-to-end tracing in controlled waves:

1. `api-gateway`
2. NestJS microservices
3. `analytics-ms` + `intelligence-fn-rs`

Rollback is always possible by setting `OTEL_SDK_DISABLED=true` on the targeted workloads.

## Prerequisites

- Monitoring stack applied from `backend/k8s/monitoring`.
- Grafana datasources include `loki` and `tempo`.
- `burrito-config` includes:
  - `OTEL_EXPORTER_OTLP_ENDPOINT`
  - `OTEL_SERVICE_NAMESPACE`
  - `OTEL_RESOURCE_DEPLOYMENT_ENVIRONMENT`
  - `BURRITO_NAMESPACE`

## Wave 0 - Platform

1. Apply monitoring resources:
   - `kubectl -n monitoring apply -k backend/k8s/monitoring`
2. Validate components:
   - `kubectl -n monitoring get pods | grep -E 'tempo|otel-collector|loki|promtail'`
3. Validate collector metrics target:
   - `kubectl -n monitoring get servicemonitor otel-collector`

## Wave 1 - API Gateway

1. Deploy only `api-gateway` with OTel enabled (`OTEL_SDK_DISABLED=false`).
2. Send traffic to `/auth` and `/graphQL`.
3. Validate:
   - Tempo receives traces for `service.name=api-gateway`.
   - Logs in Loki include `trace_id` for gateway requests.
   - Dashboard inbound gateway panel is non-empty.

Rollback:

- Set `OTEL_SDK_DISABLED=true` for `api-gateway` and redeploy.

## Wave 2 - NestJS Microservices

1. Enable OTel on:
   - `users-ms`, `groups-ms`, `forms-ms`, `evaluations-ms`, `notifications-ms`.
2. Validate Redis RPC continuity:
   - One trace should include gateway + at least one downstream service span.
3. Validate alerts remain green:
   - No `BurritoOtelCollectorSendFailedSpans`.
   - No sustained `BurritoTraceContinuityDegraded`.

Rollback:

- Disable OTel only for the impacted service(s) with `OTEL_SDK_DISABLED=true`.

## Wave 3 - Analytics + Knative Intelligence

1. Enable/confirm OTel for `analytics-ms`.
2. Generate a text analytics workflow:
   - request stream -> knative function -> result stream -> ack.
3. Validate:
   - Redis stream records include `traceparent`, `producer_service`, `produced_at`.
   - DLQ messages preserve observability metadata.
   - Tempo shows linked spans around stream produce/consume.

Rollback:

- Disable OTel in `analytics-ms`.
- Keep stream metadata propagation enabled (safe, backward-compatible).

## Post-rollout checks

1. Traces:
   - End-to-end request path visible from edge to downstream services.
2. Logs:
   - `trace_id` present in gateway and service logs.
3. Metrics:
   - `otelcol_*` metrics scraped.
4. Dashboards:
   - Edge inbound, gateway outbound, and stream throughput panels populated.
