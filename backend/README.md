# Burrito Backend

The Burrito backend is a NestJS monorepo that powers the API gateway and a set
of microservices for users, groups, forms, evaluations, analytics, and
notifications. It uses MongoDB for persistence, Redis for queues/caching, and a
Rust Knative function for optional NLP enrichment.

## Features

- GraphQL API gateway with JWT-based auth and refresh flow.
- Microservice architecture for user, group, form, evaluation, analytics, and
  notifications domains.
- Analytics snapshots with NPS, rating distributions, and time-series counts.
- Optional NLP enrichment through Redis Streams + Knative intelligence function.
- Email notifications with templates and queue-based delivery (BullMQ).
- Docker Compose and Kubernetes manifests for local and production deploys.

## Services

- `api-gateway`: GraphQL API and REST auth endpoints (`/auth/*`).
- `users-ms`: users, authentication, and email verification.
- `groups-ms`: groups and memberships; links forms to groups.
- `forms-ms`: form definitions, questions, status lifecycle.
- `evaluations-ms`: evaluation submissions and respondent tracking.
- `analytics-ms`: analytics snapshots and aggregations.
- `notifications-ms`: email notifications and reminders.
- `intelligence-fn-rs`: Rust function service for sentiment + idea extraction
  (lives under `backend/apps/intelligence-fn-rs`).

Legacy Python `apps/intelligence-ms` remains for reference and is not part of active deployment.

## Repository Layout

```
backend/
├── apps/
│   ├── api-gateway/
│   ├── users-ms/
│   ├── groups-ms/
│   ├── forms-ms/
│   ├── evaluations-ms/
│   ├── analytics-ms/
│   ├── notifications-ms/
│   └── intelligence-fn-rs/     # Rust service
├── libs/                        # shared TypeScript code
├── scripts/                     # seed and utility scripts
├── docker-compose.yml
├── k8s/                         # Kubernetes manifests
└── .env.example
```

## Prerequisites

- Node.js 18+
- Docker (recommended for MongoDB/Redis/MailHog)
- Rust 1.88+ if running `intelligence-fn-rs` without Docker

## Setup

1. Create the environment file:

```bash
cp .env.example .env
```

2. Update secrets and URLs as needed:
   - `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
   - `DATABASE_*` and `MONGODB_*`
   - `SMTP_*`, `MAILHOG_*`, `WEB_APP_URL`
   - `HUGGINGFACE_HUB_TOKEN` (only for NLP enrichment)

## Local Development (Docker Compose)

```bash
docker compose up --build
```

This starts:
- MongoDB on `27017`
- Redis on `6379`
- MailHog on `8025`
- All NestJS services
- `intelligence-fn-rs` (Rust)

## Local Development (Manual)

Start dependencies:

```bash
docker compose up mongo redis mailhog
```

Install and run services:

```bash
npm install

npx nest start api-gateway --watch
npx nest start users-ms --watch
npx nest start groups-ms --watch
npx nest start forms-ms --watch
npx nest start evaluations-ms --watch
npx nest start analytics-ms --watch
npx nest start notifications-ms --watch
```

Optional NLP function:

```bash
cd apps/intelligence-fn-rs
cargo run
```

## API Endpoints

- GraphQL: `POST /graphQL` (case-sensitive)
- Auth: `POST /auth/login`, `GET /auth/refresh`

The full GraphQL schema is generated in `schema.gql`.

## Configuration Notes

- Analytics enrichment:
  - `ANALYTICS_ENABLE_INTELLIGENCE=true`
  - `ANALYTICS_INTELLIGENCE_REQUEST_STREAM`, `ANALYTICS_INTELLIGENCE_RESULT_STREAM`, `ANALYTICS_INTELLIGENCE_DLQ_STREAM`
- Analytics snapshot control:
  - `ANALYTICS_SNAPSHOT_TTL_SECONDS`
  - `ANALYTICS_TIME_BUCKET=day|week`
- Notifications:
  - `NOTIFICATIONS_QUEUE_ENABLED`
  - `NOTIFICATIONS_RETRY_ATTEMPTS`, `NOTIFICATIONS_BACKOFF_MS`

## Seeding and Demo Data

Analytics seed (direct MongoDB):

```bash
npm run populate
```

API-driven population plan is documented in `../docs/demo-population-plan.md`.

## Testing

```bash
npm test
npm run test:e2e
```

## Docker Images

The Docker build uses `backend/Dockerfile` and supports `SERVICE_NAME` to build
individual NestJS services. The Rust intelligence image is built from
`apps/intelligence-fn-rs/Dockerfile`.

## Deployment

- CI/CD: `../Jenkinsfile` (build/test/push + GitOps image promotion)
- GitOps deployment: Argo CD (`k8s/argocd/` + `k8s/overlays/prod/`)
- Kubernetes manifests: `k8s/`
- Infra automation: `infra/` (Terraform + Ansible)

## Troubleshooting

- GraphQL path must be `/graphQL` (capital Q + L).
- If auth fails, verify `JWT_*` settings and `WEB_APP_URL`.
- If emails are not delivered locally, check MailHog at `http://localhost:8025`.
- NLP enrichment requires Knative and RedisStreamSource manifests (`k8s/intelligence-fn-rs.knative.yaml`).
