# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: NestJS monorepo for microservices and infra.
- `backend/apps/`: deployable services (`api-gateway`, `users-ms`, `groups-ms`, `forms-ms`, `evaluations-ms`, `analytics-ms`, `notifications-ms`) plus `intelligence-fn-rs` (Rust).
- `backend/libs/common/`: shared backend types, config, telemetry, and helpers.
- `backend/scripts/`, `backend/k8s/`, `backend/infra/`: local tooling, Kubernetes manifests, Terraform/Ansible.
- `burrito-front/`: Angular SSR frontend (`src/app` for pages/components/services, `src/server.ts` for SSR runtime config).
- `docs/`: project plans and runbooks. Root `Jenkinsfile` defines CI/CD.

## Build, Test, and Development Commands
- Backend setup: `cd backend && npm install`
- Backend dev: `npm run start:dev` (Nest watch mode), `npm run build` (compile services), `npm run lint` (ESLint + fix), `npm test` (Jest).
- Frontend setup: `cd burrito-front && npm install`
- Frontend dev: `npm start` (Angular dev server on `:4200`), `npm run build` (localized SSR build), `npm test` (Karma/Jasmine).
- Full local stack: `cd backend && docker compose up --build` (services + MongoDB + Redis + MailHog).
- Kubernetes: All commands run with

## Coding Style & Naming Conventions
- Use TypeScript with 2-space indentation, UTF-8, and single quotes.
- Backend formatting/linting is enforced by ESLint + Prettier (`backend/eslint.config.mjs`).
- Frontend follows Angular conventions and `.editorconfig` (`burrito-front/.editorconfig`).
- Keep established naming patterns: `*.module.ts`, `*.service.ts`, `*.controller.ts`, `*.component.ts`.
- Place shared backend logic in `backend/libs/common`; keep service-specific logic inside each app folder.

## Testing Guidelines
- Backend: Jest (`npm test`); Frontend: Jasmine/Karma (`npm test`).
- Test file naming: `*.spec.ts`.
- Add or update tests with each behavior change, especially across gateway-to-microservice boundaries.
- Current repository has limited tracked tests; prioritize adding tests near modified code.

## Commit & Pull Request Guidelines
- Follow Conventional Commits as used in history: `feat(scope): ...`, `fix(scope): ...`, `ci: ...`, `infra(scope): ...`.
- Keep commit subjects imperative and scoped (example: `feat(api-gateway): add burn-5xx endpoint`).
- PRs should include: purpose, impacted paths, env/config changes, test evidence, and screenshots for frontend UI changes.

## Kubernetes Contexts

### Available contexts
- docker-desktop → local Kubernetes (Docker Desktop)
- burrito-k3s → remote Burrito VPS cluster (https://burrito.deway.fr:6443)

### Usage
List contexts:
`kubectl config get-contexts`

Switch context:
`kubectl config use-context docker-desktop`
`kubectl config use-context burrito-k3s`

Check current context:
`kubectl config current-context`

### Safety
Always verify context before running apply/delete commands.