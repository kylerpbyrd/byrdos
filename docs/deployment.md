# Deployment & Migration Runbook

This document describes how to build, migrate, and run the byrdOS backend
services in staging and production-like environments.

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

> `apps/web` (Next.js) is not containerized here. Per ADR-0010 it deploys to
> Vercel. Add `output: 'standalone'` to `apps/web/next.config.ts` first if you
> ever need a containerized web image.

## Build images

```bash
# One-off builds
docker build --build-arg PACKAGE=@byrdos/api --build-arg SERVICE_DIR=apps/api --build-arg CMD="node dist/main.js" -t byrdos/api:latest .
docker build --build-arg PACKAGE=@byrdos/sync-worker --build-arg SERVICE_DIR=services/sync-worker -t byrdos/sync-worker:latest .
docker build --build-arg PACKAGE=@byrdos/webhook-worker --build-arg SERVICE_DIR=services/webhook-worker -t byrdos/webhook-worker:latest .
docker build --build-arg PACKAGE=@byrdos/scheduler --build-arg SERVICE_DIR=services/scheduler -t byrdos/scheduler:latest .
docker build --build-arg PACKAGE=@byrdos/outbox-relay --build-arg SERVICE_DIR=services/outbox-relay -t byrdos/outbox-relay:latest .

# Or build the entire staging stack
docker compose -f docker-compose.staging.yml build
```

## Environment variables

Runtime secrets are **never baked into images**. Services read environment
variables at container startup.

For local/staging Docker Compose, copy the example file and fill in real values:

```bash
cp .env.example .env.staging
# edit .env.staging
```

Required variables for the staging stack:

- `DATABASE_URL` — Postgres connection string (used by `@byrdos/db` and all
  services).
- `REDIS_URL` — Redis connection string (used by BullMQ workers).
- `PORT` — API listen port (default `4000` inside the container).

Additional application secrets (JWT, OAuth providers, API keys, etc.) must be
added to `.env.staging` or injected by the container host.

On managed platforms (Fly.io, Render, AWS ECS, etc.) set the same variables
through the platform's secret/parameter store. The images themselves are
platform-agnostic.

## Run migrations

Migrations run as a one-shot container before the API and workers start. In
Compose this is enforced with `depends_on`:

```bash
# Run only the migration job
docker compose -f docker-compose.staging.yml --env-file .env.staging run --rm migrate

# Or start the full stack; migrate runs first and api/workers wait for it
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d
```

The migration image is built from the same `Dockerfile` with
`PACKAGE=@byrdos/db`, `SERVICE_DIR=packages/db`, and `CMD="pnpm run db:migrate"`.
It requires the `DATABASE_URL` environment variable.

### Production migration gate

Before any production rollout, confirm the migration job exits cleanly. Do not
roll out new service versions while pending migrations exist. Destructive
schema changes must follow the expand/contract pattern per ADR-0000.

## Bring up staging

```bash
# Create/update .env.staging first
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d
```

Services exposed:

- `api` — `http://localhost:4000`
- `postgres` — `localhost:5432`
- `redis` — `localhost:6379`

Workers (`sync-worker`, `webhook-worker`, `scheduler`, `outbox-relay`) do not
expose ports.

## Shutdown / reset

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
