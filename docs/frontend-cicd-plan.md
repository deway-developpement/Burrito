# Frontend CI/CD and Deployment Plan

## Goal
- Add frontend build/deploy to the existing Jenkins + Kubernetes pipeline.
- Serve frontend and backend together with correct routing and cookies.
- Make the deployment reproducible with safe rollbacks.

## Current State (observed)
- Backend CI/CD builds and deploys backend services only via the root `Jenkinsfile`.
- BuildKit remote is used (`BUILDKIT_HOST=tcp://buildkit:1234`) and images are pushed to `${REGISTRY_HOST}`.
- Frontend is Angular SSR (`outputMode: server`) in `burrito-front/angular.json`.
- Apollo client targets `/graphQL` with `withCredentials: true` in `burrito-front/src/app/app.config.ts`.
- Dev proxy routes `/auth`, `/api`, `/graphQL` to `localhost:3000` in `burrito-front/proxy.conf.json`.
- Backend ConfigMap points to localhost for `WEB_APP_URL` and `EMAIL_VERIFICATION_URL_BASE` in `backend/k8s/evaluation-system.yaml`.

## Target Architecture (Required)
- Frontend: `https://burrito.deway.fr/` served by the frontend service.
- API: `https://api.burrito.deway.fr/` served by the `api-gateway` service.
- GraphQL path remains `https://api.burrito.deway.fr/graphQL` (case-sensitive).
- Auth endpoints remain `https://api.burrito.deway.fr/auth/*`.
- This is cross-origin and must be handled via CORS + auth token strategy (details below).

## Implementation Plan (High-Level)
1. Add frontend container build (Dockerfile + .dockerignore).
2. Add frontend Kubernetes manifests (Deployment, Service, Ingress, optional HPA).
3. Extend Jenkins pipeline to build/push/deploy frontend image.
4. Wire routing and config (Ingress + ConfigMap updates).
5. Add health checks, monitoring hooks, and rollback process.
6. Validate end-to-end in production.

## Frontend Build and Runtime
### Dockerfile (SSR)
- Multi-stage build:
  - Build stage: `npm ci` and `npm run build` in `burrito-front`.
  - Runtime stage: Node base image compatible with Angular SSR.
- Expose port 4000 (default in `burrito-front/src/server.ts`).
- Set `NODE_ENV=production` and `PORT=4000`.
- Run as a non-root user if the base image supports it.
- Add `HEALTHCHECK` (optional) or rely on Kubernetes probes.

### Runtime Config Strategy
- Use an absolute API base URL: `https://api.burrito.deway.fr`.
- Implement runtime injection so SSR and browser both use the same base:
  - Option 1: read `API_BASE_URL` from `process.env` in `burrito-front/src/server.ts` and pass it into SSR.
  - Option 2: generate `/env.js` on container start and load it in `index.html`.
- Update Apollo and HttpClient callers to use the base URL instead of relative `/graphQL` and `/auth`.
- Never ship secrets in the frontend image or `env.js`.

## Kubernetes Changes
### Deployment
- Image: `registry.burrito.deway.fr/burrito-frontend:<tag>`.
- Container port 4000.
- Readiness probe: `GET /` or a dedicated `/health`.
- Liveness probe: same path with a larger initial delay.
- Resources: set `requests` and `limits` to avoid OOM.
- Rolling updates: `maxSurge: 1`, `maxUnavailable: 0`.

### Service
- ClusterIP service, port 80 -> 4000.

### Ingress
- Frontend Ingress:
  - Host: `burrito.deway.fr`.
  - Path: `/` -> frontend service.
- API Ingress:
  - Host: `api.burrito.deway.fr`.
  - Paths: `/graphQL`, `/auth`, `/api` -> `api-gateway` service.
- Avoid a global `rewrite-target: /` on the API ingress because it can break `/graphQL`.
- TLS: configure cert-manager or use a pre-provisioned secret for both hosts.

### HPA (optional)
- Start with min 2 replicas for SSR.
- Scale on CPU or memory once baseline usage is known.

## Jenkins Pipeline Changes
### Build Frontend Image
- Add a new stage to build/push `burrito-frontend` with BuildKit:
  - Context: `burrito-front`.
  - Tags: `${BUILD_NUMBER}` and `latest`.
- Make sure BuildKit has access to registry credentials.

### Deploy Frontend
- `kubectl apply` frontend manifests.
- `kubectl set image deployment/burrito-frontend ...:${BUILD_NUMBER}`.
- `kubectl rollout status deployment/burrito-frontend`.

### Conditional Execution
- Run frontend stages only when `burrito-front/**` or frontend K8s files change.
- Avoid rebuilding all backend services for frontend-only changes.

### Credentials and Access
- Ensure Jenkins service account can deploy to the target namespace.
- Confirm registry auth works for BuildKit pushes.

## Linking Frontend and Backend
- Update ConfigMap in `backend/k8s/evaluation-system.yaml`:
  - `WEB_APP_URL` -> `https://burrito.deway.fr`.
  - `EMAIL_VERIFICATION_URL_BASE` -> `https://burrito.deway.fr/verify-email`.
- Keep API paths stable at `https://api.burrito.deway.fr`.
- Add CORS in `backend/apps/api-gateway/src/main.ts`:
  - `origin: ['https://burrito.deway.fr']`
  - `credentials: true` if using cookies
  - `allowedHeaders` must include `Authorization`, `Content-Type`, `refresh_token`
  - `methods` include `GET,POST,PUT,DELETE,OPTIONS`
- Auth token strategy:
  - If staying with localStorage tokens (current), set `withCredentials: false` for GraphQL to avoid requiring `Access-Control-Allow-Credentials`.
  - If moving to cookie-based refresh tokens, set cookie attributes: `HttpOnly`, `Secure`, `SameSite=None`, and `Domain=.burrito.deway.fr` (or host-only on `api.burrito.deway.fr`) and keep `withCredentials: true`.
- Email verification flow:
  - Email points to `https://burrito.deway.fr/verify-email?...`.
  - Frontend parses the token and calls `https://api.burrito.deway.fr/...` to verify.

## Observability and Operations
- Frontend logs go to stdout from the Node SSR server.
- Add a basic ingress health check or alert on 5xx/latency.
- Consider cache headers for static assets (long cache) vs SSR HTML (short cache).

## Rollback and Safety
- Keep previous image tags for quick rollback.
- Use `kubectl rollout undo deployment/burrito-frontend`.
- Verify frontend is stateless (no persistent volumes required).

## Validation Checklist
- CI build passes for frontend.
- Frontend host works: `https://burrito.deway.fr/` returns Angular HTML.
- API host works: `https://api.burrito.deway.fr/graphQL` returns GraphQL responses.
- `https://api.burrito.deway.fr/auth/login` and `/auth/refresh` work with the chosen token strategy.
- CORS preflight succeeds for `Authorization` and `refresh_token` headers.
- SSR response time is within acceptable limits.
- Email verification links point to deployed frontend.
- Rollback tested at least once.

## Files to Add or Update
- `burrito-front/Dockerfile`
- `burrito-front/.dockerignore`
- `backend/k8s/frontend.yaml` (or update `backend/k8s/evaluation-system.yaml`)
- `Jenkinsfile`
- `backend/k8s/evaluation-system.yaml` (ConfigMap URL updates)
- `burrito-front/src/app/app.config.ts` (Apollo base URL)
- `burrito-front/src/app/services/auth.service.ts` (auth base URL)
- `burrito-front/src/server.ts` (SSR runtime config)
- `backend/apps/api-gateway/src/main.ts` (CORS)

## Open Questions / Decisions
- TLS certificate source for `burrito.deway.fr` and `api.burrito.deway.fr`.
- Keep SSR or switch to static build.
- Add a dedicated `/health` endpoint in `burrito-front/src/server.ts`.
- Standardize Node version between Jenkins builder and frontend runtime image.
