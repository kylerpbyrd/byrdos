# Deployment & Migration Runbook

This document describes how to build, migrate, and run the byrdOS backend
services in staging and production.

- Platform: **Fly.io** for `apps/api` and all `services/*` workers.
- Database: **Neon** (managed Postgres).
- Cache/queue: **Upstash** (managed Redis).
- Frontend: **Vercel** (see `apps/web` — not covered here).
- Observability: self-hosted **OpenTelemetry Collector + Prometheus + Grafana**.

## Container strategy

A single parameterized `Dockerfile` at the repository root builds every Node
backend service. It uses the standard Turborepo pattern:

1. `turbo prune --docker <SERVICE>` creates the smallest monorepo slice.
2. `pnpm install --frozen-lockfile` installs only that slice.
3. `pnpm run build --filter=<SERVICE>...` builds the service and its workspace
   dependencies.
4. The `runner` stage copies the pruned, built workspace tree onto a
   non-root user image.

Two build arguments identify the service:

- `PACKAGE` — the npm package name used by `turbo prune` (e.g. `@byrdos/api`).
- `SERVICE_DIR` — the filesystem path of the workspace package (e.g. `apps/api`).

The optional `CMD` argument defaults to `node dist/index.js`; pass
`node dist/main.js` for `apps/api` or `pnpm run db:migrate` for the migration
job.

## Fly.io app naming

All Fly configs live in `deploy/fly/<service>.toml`. The base `app` name in each
file is the production app; CI overrides it with `--app byrdos-<service>-staging`
for staging deploys.

| Service | Package | Directory | Fly app (prod) | Fly app (staging) |
|---|---|---|---|---|
| API | `@byrdos/api` | `apps/api` | `byrdos-api` | `byrdos-api-staging` |
| Sync worker | `@byrdos/sync-worker` | `services/sync-worker` | `byrdos-sync-worker` | `byrdos-sync-worker-staging` |
| Webhook worker | `@byrdos/webhook-worker` | `services/webhook-worker` | `byrdos-webhook-worker` | `byrdos-webhook-worker-staging` |
| Scheduler | `@byrdos/scheduler` | `services/scheduler` | `byrdos-scheduler` | `byrdos-scheduler-staging` |
| Outbox relay | `@byrdos/outbox-relay` | `services/outbox-relay` | `byrdos-outbox-relay` | `byrdos-outbox-relay-staging` |

Only `byrdos-api` exposes a public port (`:4000`). Workers are internal and have
no `[http_service]` section.

## Provision infrastructure

### 1. Neon Postgres

1. Create a Neon project at https://console.neon.tech.
2. Create branches:
   - `main` → production database.
   - `staging` → staging database (branch from `main`).
3. Enable **connection pooling** in Neon and copy the pooled connection string.
4. Store the connection strings as GitHub secrets and Fly secrets:
   - `NEON_DATABASE_URL` (GitHub secret) → used by the deploy workflow.
   - `DATABASE_URL` (Fly secret) → the same Neon pooled URL, used at runtime.

Example Fly secret set for staging:

```bash
flyctl secrets set --app byrdos-api-staging DATABASE_URL="postgresql://..."
```

Repeat for every Fly app and for production.

### 2. Upstash Redis

1. Create an Upstash Redis database at https://console.upstash.com.
2. Copy the **Redis URL** (TLS enabled).
3. Store it as:
   - `UPSTASH_REDIS_URL` (GitHub secret).
   - `REDIS_URL` (Fly secret) → used at runtime.

Example:

```bash
flyctl secrets set --app byrdos-api-staging REDIS_URL="rediss://default:..."
```

### 3. Fly.io apps

Create each app once. You do **not** need to run `fly launch`; `fly apps create`
is enough because the deploy workflow and `fly.toml` files contain all config.

```bash
# Production
for app in byrdos-api byrdos-sync-worker byrdos-webhook-worker byrdos-scheduler byrdos-outbox-relay; do
  flyctl apps create "$app"
done

# Staging
for app in byrdos-api-staging byrdos-sync-worker-staging byrdos-webhook-worker-staging byrdos-scheduler-staging byrdos-outbox-relay-staging; do
  flyctl apps create "$app"
done
```

Then set all runtime secrets on every app. The minimum required set is:

| Fly secret | Source / value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon pooled connection string | Required by all services. |
| `REDIS_URL` | Upstash Redis URL | Required by all services. |
| `PORT` | `4000` | Required by `apps/api`. |
| `WEB_URL` | Vercel deployment URL | Required by `apps/api` (OAuth callbacks, emails). |
| `AUTH_SECRET` | Random 32+ byte string | JWT/session signing. Generate with `openssl rand -base64 32`. |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | Required if using Google auth. |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | Required if using Google auth. |
| `CREDENTIAL_ENCRYPTION_KEY` | Random 32-byte hex string | Encrypts stored provider credentials. Generate once and never rotate without a re-encryption job. |
| `PLAID_CLIENT_ID` | Plaid client ID | Required by sync/webhook workers and API. |
| `PLAID_SECRET` | Plaid secret | Required by sync/webhook workers and API. |
| `PLAID_WEBHOOK_KEY` | Plaid webhook verification key | Required by `webhook-worker`. |
| `PLAID_ENV` | `sandbox` / `development` / `production` | Required by Plaid integration. |
| `ALERT_WEBHOOK_URL` | Slack incoming webhook URL | Used by `packages/observability` `sendAlert()`. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://<collector>:4318` | Send traces/metrics to the self-hosted collector. Use HTTPS if the collector is public. |

Production example for `byrdos-api`:

```bash
flyctl secrets set --app byrdos-api \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="rediss://..." \
  PORT="4000" \
  WEB_URL="https://byrdos.io" \
  AUTH_SECRET="$(openssl rand -base64 32)" \
  AUTH_GOOGLE_ID="..." \
  AUTH_GOOGLE_SECRET="..." \
  CREDENTIAL_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  PLAID_CLIENT_ID="..." \
  PLAID_SECRET="..." \
  PLAID_WEBHOOK_KEY="..." \
  PLAID_ENV="production" \
  ALERT_WEBHOOK_URL="https://hooks.slack.com/services/..." \
  OTEL_EXPORTER_OTLP_ENDPOINT="https://otel.byrdos.io:4318"
```

Repeat for every production and staging app, changing `WEB_URL`, `PLAID_ENV`,
and any environment-specific values as needed.

### 4. GitHub secrets for deploy CI

Add these repository secrets (Settings → Secrets and variables → Actions):

| Secret | Purpose |
|---|---|
| `FLY_API_TOKEN` | Fly.io API token for `flyctl deploy`. Create at https://fly.io/user/personal_access_tokens. |
| `NEON_DATABASE_URL` | Pooled Neon connection string used by the migration job. |
| `UPSTASH_REDIS_URL` | Upstash Redis URL (reserved for future CI use; currently set on Fly apps only). |
| `ALERT_WEBHOOK_URL` | Slack webhook used by the failure notification step. |

The workflow uses GitHub deployment environments named `staging` and `production`.
These are created automatically on first run. You can add protection rules
(required reviewers, wait timers) under Settings → Environments after the first
deploy.

## Run migrations

Migrations run as a one-shot job before the API and workers start.

### Local / Docker Compose

```bash
# Run only the migration job
docker compose -f docker-compose.staging.yml --env-file .env.staging run --rm migrate

# Or start the full stack; migrate runs first and api/workers wait for it
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d
```

The migration image is built from the same `Dockerfile` with
`PACKAGE=@byrdos/db`, `SERVICE_DIR=packages/db`, and `CMD="pnpm run db:migrate"`.
It requires the `DATABASE_URL` environment variable.

### Staging / production (CI)

The `.github/workflows/deploy.yml` workflow runs migrations automatically on
push to `main` and on tag `v*`. The `migrate` job gates deploy: if migrations
fail, the matrix deploy jobs do **not** run.

To run migrations manually from a local machine (useful for hotfixes):

```bash
export DATABASE_URL="<neon-pooled-url>"
pnpm install
pnpm --filter @byrdos/db build
pnpm --filter @byrdos/db db:migrate
```

### Production migration gate

Before any production rollout, confirm the migration job exits cleanly. Do not
roll out new service versions while pending migrations exist. Destructive
schema changes must follow the expand/contract pattern per ADR-0000.

## Deploy to staging

Pushing to `main` triggers `.github/workflows/deploy.yml` automatically:

1. Runs `pnpm --filter @byrdos/db db:migrate` against the **staging** Neon URL.
2. If migrations succeed, deploys all five Fly apps to their `-staging` names.

Manual deploy from a local machine:

```bash
# API
flyctl deploy --config deploy/fly/api.toml --app byrdos-api-staging

# Workers
flyctl deploy --config deploy/fly/sync-worker.toml --app byrdos-sync-worker-staging
flyctl deploy --config deploy/fly/webhook-worker.toml --app byrdos-webhook-worker-staging
flyctl deploy --config deploy/fly/scheduler.toml --app byrdos-scheduler-staging
flyctl deploy --config deploy/fly/outbox-relay.toml --app byrdos-outbox-relay-staging
```

## Deploy to production

Create and push a semantic version tag:

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

The same `deploy.yml` workflow runs against production app names (no `-staging`
suffix):

1. Runs migrations against the **production** Neon URL.
2. If migrations succeed, deploys all five production Fly apps.

Rollback (if a deploy is bad but the migration already ran):

```bash
# Redeploy the previous image or commit
flyctl deploy --config deploy/fly/api.toml --app byrdos-api --image <previous-image-ref>
```

Schema changes must remain backward-compatible so rollback is safe.

## Observability stack

Bring up the self-hosted stack on any Docker host (a Fly Machine, VPS, or local
server):

```bash
docker compose -f docker-compose.observability.yml up -d
```

Endpoints:

| Service | URL | Default credentials |
|---|---|---|
| Grafana | http://localhost:3000 | `admin` / `admin` (override via `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD`) |
| Prometheus | http://localhost:9090 | none |
| OTel Collector OTLP/HTTP | http://localhost:4318 | none |
| OTel Collector OTLP/gRPC | http://localhost:4317 | none |
| OTel Collector Prometheus exporter | http://localhost:9464 | none |

Services send traces and metrics to the collector over OTLP/HTTP:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://<collector-host>:4318
```

The collector exports:

- **Traces** to the `debug` exporter (console) initially. Add a vendor exporter
  later without code changes because services emit standard OTLP.
- **Metrics** to the `prometheus` exporter on `:9464`; Prometheus scrapes that
  endpoint.
- **Prometheus** optionally scrapes `apps/api` `/metrics` if the API is
  network-reachable from the Prometheus host (see `deploy/observability/prometheus.yml`).

To make the collector reachable from Fly apps, deploy it as a Fly app with a
private or public endpoint, or run it on a host connected to Fly via WireGuard.
Update `OTEL_EXPORTER_OTLP_ENDPOINT` on every Fly app to point to it.

## Load and security testing

After staging is up, run the existing k6 and ZAP workflows against it.

### k6 load test

The workflow is defined in `.github/workflows/k6-load.yml`. To run locally
against staging:

```bash
# Requires k6: https://k6.io/docs/get-started/installation/
export API_BASE=https://byrdos-api-staging.fly.dev
k6 run tests/load/k6-smoke.js
k6 run tests/load/k6-load.js
```

### OWASP ZAP scan

The workflow is defined in `.github/workflows/zap-scan.yml`. To run locally:

```bash
# Requires Docker
docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t https://byrdos-api-staging.fly.dev
```

## Local development stack

For local development without managed services:

```bash
docker compose up -d
```

This starts Postgres and Redis on `localhost`. Use `.env.example` as a template
for `.env`.

## Shutdown / reset (local)

```bash
# Stop everything
docker compose -f docker-compose.staging.yml --env-file .env.staging down

# Stop and delete the Postgres volume
docker compose -f docker-compose.staging.yml --env-file .env.staging down -v
```

## Deploying to other platforms

The images produced by the root `Dockerfile` are platform-agnostic. Deploy them
by:

1. Pushing the built images to your registry.
2. Setting the same runtime environment variables through the platform's
   secret/parameter mechanism.
3. Running the migration image as a one-shot job before rolling out the
   long-running services.
4. Ensuring Postgres and Redis (or their managed equivalents) are reachable
   from the containers.

There is no vendor-specific configuration inside the images.
