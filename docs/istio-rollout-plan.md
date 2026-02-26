# Istio Rollout Plan (Evaluation System)

This runbook installs Istio control plane while keeping Traefik as the north-south entrypoint. The edge workload remains `api-gateway` with an Istio sidecar.

## Target posture

- `mesh-role=app`: `STRICT` mTLS after cutover.
- `mesh-role=data` (`mongo`, `redis`): `PERMISSIVE` durable.
- External traffic path stays `Traefik Ingress -> api-gateway Service -> api-gateway Pod (+ istio-proxy)`.

## Prerequisites

1. Apply Terraform changes in `backend/infra/terraform/cluster`.
2. Confirm Istio control plane is healthy:
   - `kubectl -n istio-system get pods`
   - `kubectl get crd | grep -i peerauthentication`

## Rollout order

1. Deploy backend manifests and Istio PeerAuthentication resources with pipeline parameter:
   - `ISTIO_MTLS_PHASE=permissive`
2. Verify sidecar injection on targeted workloads:
   - `kubectl -n evaluation-system get pods`
   - `kubectl -n evaluation-system get pod <pod-name> -o jsonpath='{.spec.containers[*].name}'`
3. Validate functional traffic:
   - `https://api.burrito.deway.fr/status`
   - `https://api.burrito.deway.fr/auth/*`
   - `https://api.burrito.deway.fr/graphQL`
4. Validate data-plane workloads:
   - `mongo` and `redis` pods include `istio-proxy`.
   - mongodb/redis exporter metrics remain reachable.
5. Cut over app workloads:
   - rerun pipeline with `ISTIO_MTLS_PHASE=strict`.

## Health checks after strict cutover

1. No failing rollouts:
   - `kubectl -n evaluation-system get deploy`
2. No traffic regression:
   - gateway auth and GraphQL smoke checks pass.
3. No mesh policy errors:
   - `kubectl -n evaluation-system get peerauthentication`

## Rollback

1. Rerun pipeline with `ISTIO_MTLS_PHASE=permissive`.
2. The pipeline removes `peer-authn-apps-strict.yaml`.
3. Confirm only permissive policies remain:
   - `default-permissive`
   - `data-permissive`
