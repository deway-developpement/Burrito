# Burrito

Burrito is a full-stack course evaluation and feedback platform. It combines an
Angular SSR frontend, a NestJS microservice backend, and a Python NLP service
for text analytics.

## Features

- Role-based access for admins, teachers, and students with JWT auth and email verification.
- Evaluation forms with rating + text questions, scheduling, and group targeting.
- One-response-per-student evaluations enforced with respondent tokens.
- Analytics snapshots with NPS, rating distributions, and time-series trends.
- Optional NLP enrichment (sentiment + idea clustering) via gRPC.
- Email notifications for form lifecycle events, reminders, and digests.
- Internationalized UI (fr/de/es) with SSR.

## Architecture

```
Angular SSR (burrito-front)
  -> API Gateway (NestJS, GraphQL + /auth)
     -> Users MS
     -> Groups MS
     -> Forms MS
     -> Evaluations MS
     -> Analytics MS
        -> Intelligence MS (Python, gRPC, optional)
     -> Notifications MS
     -> MongoDB, Redis
```

Local email testing uses MailHog. Service orchestration uses Docker Compose and
Kubernetes manifests are in `backend/k8s`.

## Services

- `api-gateway`: GraphQL gateway and REST auth endpoints (`/auth/*`).
- `users-ms`: users, authentication, and email verification.
- `groups-ms`: groups and memberships; links forms to groups.
- `forms-ms`: form definitions, questions, status lifecycle.
- `evaluations-ms`: evaluation submissions and respondent tracking.
- `analytics-ms`: analytics snapshots, NPS, and time-series aggregates.
- `notifications-ms`: email notifications and reminders (BullMQ + SMTP).
- `intelligence-ms`: Python gRPC service for sentiment + idea extraction.

See `backend/apps/intelligence-ms/README.md` for NLP service details.

## Repository Structure

```
.
├── backend/                 # NestJS microservices + infra
│   ├── apps/                # api-gateway, users-ms, forms-ms, ...
│   ├── libs/                # shared TypeScript library code
│   ├── scripts/             # seed scripts and tooling
│   ├── docker-compose.yml   # local stack (mongo/redis/mailhog + services)
│   └── k8s/                 # Kubernetes manifests
├── burrito-front/           # Angular SSR frontend
├── docs/                    # project plans and notes
└── README.md                # this file
```

## Prerequisites

- Node.js 18+ for the backend (Dockerfile uses Node 18).
- Node.js 20+ for the frontend (Angular CLI 20).
- Python 3.8+ for the intelligence service.
- Docker (recommended for local services).
- MongoDB, Redis, MailHog if running locally without Docker.

## Setup

1. Create backend env file:

```bash
cp backend/.env.example backend/.env
```

2. Adjust values as needed (JWT secrets, SMTP, DB creds, Hugging Face token).
   See `backend/.env.example` for the full list.

## Quick Start (Docker Compose)

Run the backend stack (includes all NestJS services, MongoDB, Redis, MailHog,
and intelligence-ms):

```bash
cd backend
docker compose up --build
```

Then start the frontend:

```bash
cd burrito-front
npm install
npm start
```

Defaults:
- Frontend: `http://localhost:4200`
- API Gateway: `http://localhost:3000`
- GraphQL: `http://localhost:3000/graphQL`
- MailHog UI: `http://localhost:8025`

## Local Development (Manual)

1. Start dependencies (or use Docker):

```bash
docker compose -f backend/docker-compose.yml up mongo redis mailhog
```

2. Start backend services:

```bash
cd backend
npm install
npx nest start api-gateway --watch
npx nest start users-ms --watch
npx nest start groups-ms --watch
npx nest start forms-ms --watch
npx nest start evaluations-ms --watch
npx nest start analytics-ms --watch
npx nest start notifications-ms --watch
```

3. Optional: run the intelligence service (for NLP enrichment):

```bash
cd backend/apps/intelligence-ms
pip install -r requirements.txt
python scripts/cache_models.py
python main.py
```

4. Start the frontend:

```bash
cd burrito-front
npm install
npm start
```

The frontend dev server uses `burrito-front/proxy.conf.json` to proxy `/auth`,
`/graphQL`, and `/api` to the API gateway.

## Configuration Notes

- Frontend API base URL:
  - `API_BASE_URL` is injected at runtime (`/env.js`) and via `process.env`.
  - Defaults to `http://localhost:3000` in dev, `https://api.burrito.deway.fr` in prod.
- Analytics + intelligence:
  - `ANALYTICS_ENABLE_INTELLIGENCE=true` to enable NLP.
  - `INTELLIGENCE_GRPC_HOST` and `INTELLIGENCE_GRPC_PORT` for gRPC connection.
- Email/notifications:
  - `SMTP_*` and `MAILHOG_*` configure outbound email.
  - Queue behavior is controlled by `NOTIFICATIONS_*`.

## API Notes

- GraphQL endpoint: `POST /graphQL` (case-sensitive).
- Auth endpoints: `POST /auth/login`, `GET /auth/refresh`.
- Generated schema: `backend/schema.gql`.

## Seeding and Demo Data

- Analytics seed (direct MongoDB):

```bash
cd backend
npm run populate
```

- API-driven demo population plan: `docs/demo-population-plan.md`.

## Testing

Backend:

```bash
cd backend
npm test
npm run test:e2e
```

Frontend:

```bash
cd burrito-front
npm test
```

## Deployment

- CI/CD pipeline: `Jenkinsfile` (BuildKit + Kubernetes deploys).
- Kubernetes manifests: `backend/k8s` (including `frontend.yaml`).
- Infrastructure tools: `backend/infra` (Terraform + Ansible).

## Troubleshooting

- If GraphQL calls fail, confirm the path is `/graphQL` (capital Q + L).
- If email is not sending locally, check MailHog at `http://localhost:8025`.
- NLP enrichment requires model cache; see `backend/apps/intelligence-ms/README.md`.
