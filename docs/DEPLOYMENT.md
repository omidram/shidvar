# Deployment

## Local development

```bash
cp .env.example .env
npm run db:up
```

Leave PostgreSQL running, then:

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Docker alternative: `docker compose up -d postgres redis minio` then `npm run db:migrate`.

App: http://localhost:5500

Optional worker (expiration, matching if not run inline in dev):

```bash
npm run worker
```

## Environment

See `.env.example`. Never commit `.env`.

Required in production:

- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_SECRET` (32+ bytes)
- `ENCRYPTION_KEY` (32 bytes hex, for TOTP secrets)
- `STORAGE_*` for S3-compatible bucket
- `APP_URL`

## Processes

| Process | Command | Role |
| --- | --- | --- |
| Web | `next start` | UI + `/api/v1` |
| Worker | `tsx src/server/jobs/worker.ts` | BullMQ |
| Migrate | `prisma migrate deploy` | CI/CD before web |

## Docker

- `docker/Dockerfile` — multi-stage Next.js
- `docker-compose.yml` — local deps + optional `app` profile
- `docker-compose.prod.yml` — web + worker + deps

## CI

GitHub Actions: install, lint, typecheck, unit tests, `prisma validate`. E2E on main with Compose.

## Migrations

- Dev: `npm run db:migrate` (creates migration)
- Prod: `prisma migrate deploy` only. Never `db push` in production.
- Backups: nightly `pg_dump` (documented in runbooks); restore tested quarterly.

## Observability

- Structured JSON logs (`src/server/logger.ts`)
- `/health` liveness, `/health/ready` DB+Redis
- Request id header `x-request-id`
- Hook points for Sentry/OpenTelemetry via `OTEL_DSN` (optional)

## Seed vs production

`npm run db:seed` is forbidden in production (`NODE_ENV=production` guard). Development credentials are listed in README only.
