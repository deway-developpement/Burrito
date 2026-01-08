# Notification Service Plan (Email-Only)

## Goals
- Deliver email notifications for key events via Redis pub/sub.
- Keep it minimal but production-grade: idempotent sends, retry on failure, audit trail.
- Fit the existing stack (NestJS, Redis, MongoDB, Nodemailer, optional BullMQ).

## Scope (MVP)
- Event consumer: `form.published`
- Event consumer: `form.reminder`
- Event consumer: `evaluation.submitted`
- Event consumer: `form.closed`
- Event consumer: `form.completed` (all evaluations submitted)
- Resolve recipients via User service RPC.
- Enqueue + process send jobs (BullMQ) or direct send if queue disabled.
- Send email via Nodemailer SMTP.
- Store status with idempotency key.
- Retry on failure (BullMQ).

## Non-Goals (MVP)
- Multi-channel notifications (SMS, push).
- Complex preference management beyond email on/off.

## Architecture Choices (Analysis)
- Event transport: Redis pub/sub with Nest microservices transport. This matches existing services and reduces integration overhead.
- Queue: BullMQ on Redis. Adds retries, backoff, concurrency, and delayed jobs with little extra code. If Redis is already in use, this is the lowest-friction reliability improvement.
- Storage: MongoDB via Mongoose for a single `notifications` collection. Simple audit trail and idempotency control without extra infra.
- Email: Nodemailer SMTP. Keeps provider-neutral setup and supports free-tier SMTP relays (Brevo, Resend, Mailjet).
- Templates: Simple file-based templates (e.g., Handlebars) to avoid extra services; render HTML + text variants per type.

## Event Inputs and Outputs
### Inputs (Redis events)
- `form.published`
- `form.reminder`
- `evaluation.submitted`
- `form.closed`
- `form.completed` (all evaluations submitted)
- `analytics.digest.ready` (optional)
- `system.alert` (optional)

### Outputs
- SMTP email send to recipients.
- MongoDB audit records for each send attempt.

## Data Model
### notifications
- `type` (enum)
- `recipientEmail`
- `recipientUserId` (optional)
- `payload` (template variables)
- `status` (`QUEUED | SENT | FAILED`)
- `attempts` (number)
- `lastError` (string | null)
- `idempotencyKey` (unique)
- `createdAt`, `sentAt` (timestamps)

### preferences (optional)
- `userId`
- `emailEnabled` (boolean)
- `language` (string)
- `digestFrequency` (string)

## Idempotency Strategy
- Use `idempotencyKey = <eventId>:<recipientUserId or email>:<type>`.
- Unique index on `idempotencyKey`.
- On duplicate key, treat as already processed and skip send.

## Reliability Strategy
- Default: BullMQ queue with retries and exponential backoff.
- Store status transitions: `QUEUED -> SENT` or `FAILED`.
- Update attempts + lastError on each failure.
- If queue disabled (dev), perform direct send with manual retries capped at 1-2.

## Template Strategy
- Per event type template with subject + HTML + text.
- Use a lightweight templating engine (Handlebars or EJS).
- Variables derived from event payload and recipient context.

## Email Templates (HTML)
- Store HTML templates alongside the service or in docs for iteration.
- Each template should be responsive, table-based, and safe for common email clients.
- Start with modern, minimal layouts and inline styles.

## Service APIs (internal)
- `GET /notifications/:id` -> status and payload summary.
- `GET /notifications/failures?limit=50` -> recent failures.

## Configuration
### Required env vars
- `REDIS_URL`
- `MONGO_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `USER_SERVICE_RPC_URL` (or Nest microservice config)

### Optional env vars
- `NOTIFICATIONS_QUEUE_ENABLED` (default true)
- `NOTIFICATIONS_RETRY_ATTEMPTS` (default 5)
- `NOTIFICATIONS_BACKOFF_MS` (default 1000)
- `MAIL_PROVIDER` (brevo | resend | mailjet)

## Development Setup
- MailHog for local SMTP capture.
- Docker Compose to run Redis, Mongo, MailHog.

## Production Setup
- SMTP relay via Brevo (or Resend/Mailjet).
- BullMQ + Redis for retries and delayed reminders.
- Kubernetes Secrets for SMTP credentials.

## Implementation Steps
1. Create new Nest app (e.g., `apps/notification`) with microservice transport for Redis.
2. Add MongoDB integration with a `Notification` Mongoose schema and unique index.
3. Implement event handlers and map each event to a notification type.
4. Add recipient resolution via User service RPC client.
5. Add template rendering (subject + HTML + text).
6. Implement email sender service (Nodemailer).
7. Add BullMQ queue + worker with retry and backoff.
8. Add idempotency checks before enqueuing/sending.
9. Add internal API endpoints for status and failures.
10. Add config validation + environment samples.
11. Add basic tests for idempotency and template rendering.

## Future Enhancements
- HTML designer UI for templates.

## Risks and Mitigations
- Provider limits (free tier): implement batching and avoid sending too many at once.
- Duplicate events: enforce idempotency key unique index.
- User service latency: cache short-lived recipient data if needed.

## Open Questions
- Do we need opt-out preferences in this service or strictly in User service?
- Should `evaluation.submitted` send a confirmation, or be disabled by default?
- Do we want daily/weekly digest scheduling in this service or upstream?
