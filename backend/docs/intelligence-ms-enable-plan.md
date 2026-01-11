# Enable Intelligence MS Plan

Goal: enable the Python intelligence microservice, deploy it, and wire gRPC from analytics-ms.

## Overview
- Intelligence MS already exists at `apps/intelligence-ms` (Python + gRPC).
- Analytics MS already has a gRPC client guarded by `ANALYTICS_ENABLE_INTELLIGENCE` and `INTELLIGENCE_GRPC_HOST/PORT`.
- Work needed: container build/deploy, k8s resources, and config toggles.

## Plan
1) **Docker build/deploy**
   - Confirm the dedicated Dockerfile in `apps/intelligence-ms/Dockerfile` is used for builds.
   - Update the Jenkins pipeline to build/push `burrito-intelligence-ms` with that Dockerfile (not the root Node Dockerfile).
   - Add deploy/rollout steps for `notifications-ms` already done; include `intelligence-ms` as well.

2) **Kubernetes resources**
   - Add a `Deployment` and `Service` for `intelligence-ms` in `k8s/evaluation-system.yaml` and `k8s/evaluation-system.local.yaml`.
   - Expose gRPC port `50051` on the service.
   - Set container env for MongoDB credentials via existing `burrito-secrets` (same as other services).

3) **Configuration toggle**
   - In `k8s/evaluation-system.yaml` and `.local.yaml`, set:
     - `ANALYTICS_ENABLE_INTELLIGENCE=true`
     - `INTELLIGENCE_GRPC_HOST=intelligence-ms`
     - `INTELLIGENCE_GRPC_PORT=50051`
   - Ensure `analytics-ms` picks these via ConfigMap.

4) **gRPC linkage validation**
   - The analytics client loads `apps/intelligence-ms/proto/analytics.proto` at runtime.
   - Ensure the analytics container includes that path (it should when built from repo root).
   - If container excludes it, update analytics build context or copy proto in Dockerfile.
   - Replace dynamic `require()` usage in `apps/analytics-ms/src/analytics/analytics.service.ts` with static imports to avoid runtime resolution issues.

5) **Smoke checks**
   - Verify `intelligence-ms` pod is ready.
   - Trigger analytics snapshot that includes text answers and verify `analysisStatus` becomes `ready`.

6) **Client-side enablement**
   - Ensure the analytics client respects `ANALYTICS_ENABLE_INTELLIGENCE` and defaults to enabled in production config.

## Notes
- Intelligence MS uses MongoDB; ensure the same secrets (`DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`) are available in its deployment.
- gRPC is internal-only; no Ingress needed.
