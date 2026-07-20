# Deployment

byrdOS deploys through a progression of environments: local development, preview deployments for every pull request, staging for integration testing, and production. The deployment pipeline is automated through GitHub Actions.

This document inherits ADR-0000 §4 (modular architecture and clear ownership boundaries) and §11 (observability-first engineering).

## Environments

| Environment | Purpose | Data |
|---|---|---|
| **Local** | Developer iteration | Dockerized Postgres + Redis |
| **Preview** | Per-PR deploy | Isolated preview DB/Redis |
| **Staging** | Pre-prod integration | Synthetic data, mirror prod shape |
| **Production** | Live users | Real user data |

## Deployment targets

| Component | Target | Notes |
|---|---|---|
| `apps/web` | Vercel | Edge network, preview per PR |
| `apps/api` | Fly.io or Render | Containerized NestJS |
| `services/*` | Fly.io or Render | Separate worker containers |
| PostgreSQL | Neon or Supabase | Managed, branching for previews |
| Redis | Upstash | Serverless-friendly, BullMQ |
| Logs / traces | OTEL collector + vendor | e.g., Honeycomb, Datadog |

## CI/CD pipeline

GitHub Actions orchestrates build, test, and deploy.

### Pull request workflow

```yaml
name: PR
on: pull_request
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint typecheck test --force
      - run: pnpm turbo run build
```

### Deploy workflow

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run build
      - run: pnpm turbo run db:migrate --filter=db
      - run: flyctl deploy --config apps/api/fly.toml
      - run: flyctl deploy --config services/sync-worker/fly.toml
      - run: flyctl deploy --config services/webhook-worker/fly.toml
      - run: vercel --prod
```

### Preview workflow

- Every PR gets a Vercel preview.
- Neon branches or Supabase preview instances provision a copy of the schema.
- Preview API points to the preview database.

## Migration runbook

Database migrations are generated and committed in PRs, then applied during deployment.

### Generate

```bash
pnpm turbo run db:generate --filter=db
```

### Review

- Inspect generated SQL before committing.
- Destructive changes require explicit human approval.

### Apply

```bash
pnpm turbo run db:migrate --filter=db
```

Migrations run before the new code is deployed. If a migration is backward-incompatible, a multi-step migration is used.

## Zero-downtime rule

Deploys must not cause downtime.

- Backward-compatible schema changes are applied first.
- New application versions roll out gradually.
- Health checks must pass before traffic is routed.
- Workers drain in-flight jobs before shutting down.

### Backward-incompatible changes

1. Add new column/table in migration 1.
2. Deploy code that writes to both old and new structures.
3. Backfill data.
4. Deploy code that reads from the new structure.
5. Drop old column/table in migration 2.

## Health checks

Each service exposes a `/health` endpoint or equivalent:

- `apps/api` — HTTP health check.
- `services/*` — BullMQ worker liveness via Redis heartbeat.

## Rollback

- Container deployments can be rolled back to the previous image.
- Database rollbacks follow the forward-compatible migration strategy; down migrations are avoided in production.

## Secrets

Secrets are managed per environment in:

- Vercel environment variables
- Fly.io secrets
- GitHub Actions secrets (for CI/CD tokens)
- Secret manager for encryption keys

No secrets are committed to the repository.

## Consequences

- **Positive**: Automated pipelines reduce human error.
- **Positive**: Preview environments catch integration issues early.
- **Negative**: Multi-environment secret management requires discipline.
- **Negative**: Zero-downtime migrations add steps to schema changes.
