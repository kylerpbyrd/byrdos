# Monorepo Structure and Boundaries

byrdOS uses a single-language TypeScript monorepo so that contracts, types, and tests can be shared between the frontend, backend, and workers without serialization drift. This document describes the full structure, the responsibility of each package, the boundary rules that keep the dependency graph acyclic, and how Turborepo orchestrates builds.

The layout and stack are decided in ADR-0001. Boundary enforcement is required by ADR-0000 §4 (modular architecture and clear ownership boundaries).

## Full repository tree

```
byrdos/
├─ apps/
│  ├─ web/                      # Next.js (App Router)
│  │  ├─ app/                   # Routes, layouts, loading.tsx, error.tsx
│  │  ├─ components/            # Route-local components
│  │  ├─ lib/                   # Data fetching, auth helpers
│  │  ├─ public/                # Static assets
│  │  ├─ next.config.ts
│  │  ├─ tailwind.config.ts
│  │  └─ package.json
│  └─ api/                      # NestJS REST gateway
│     ├─ src/
│     │  ├─ modules/            # One folder per bounded context
│     │  ├─ app.module.ts       # Root module wiring
│     │  └─ main.ts             # Bootstrap
│     ├─ test/
│     ├─ nest-cli.json
│     └─ package.json
├─ services/
│  ├─ sync-worker/              # BullMQ consumer for sync pipeline
│  │  ├─ src/
│  │  │  ├─ workers/
│  │  │  ├─ app-context.ts      # Standalone NestJS context
│  │  │  └─ main.ts
│  │  └─ package.json
│  ├─ webhook-worker/           # Inbound provider webhooks
│  │  ├─ src/
│  │  │  ├─ handlers/
│  │  │  ├─ app-context.ts
│  │  │  └─ main.ts
│  │  └─ package.json
│  └─ scheduler/                # Cron producer for repeatable jobs
│     ├─ src/
│     │  ├─ jobs/
│     │  ├─ app-context.ts
│     │  └─ main.ts
│     └─ package.json
├─ packages/
│  ├─ config/                   # eslint, prettier, tsconfig presets
│  │  ├─ eslint/
│  │  ├─ prettier/
│  │  └─ tsconfig/
│  ├─ tsconfig/                 # Base tsconfigs per runtime
│  ├─ domain/                   # Pure domain models, VOs, events
│  │  ├─ src/
│  │  │  ├─ identity/
│  │  │  ├─ provider-link/
│  │  │  ├─ account/
│  │  │  ├─ transaction/
│  │  │  ├─ sync/
│  │  │  ├─ budget/
│  │  │  ├─ transfer/
│  │  │  ├─ insight/
│  │  │  └─ index.ts
│  │  └─ package.json
│  ├─ contracts/                # Zod DTOs, OpenAPI types
│  │  ├─ src/
│  │  │  ├─ requests/
│  │  │  ├─ responses/
│  │  │  ├─ events/
│  │  │  └─ index.ts
│  │  └─ package.json
│  ├─ provider-sdk/             # Aggregator adapters + common interface
│  │  ├─ src/
│  │  │  ├─ adapter.interface.ts
│  │  │  ├─ provider-registry.ts
│  │  │  ├─ plaid/
│  │  │  └─ errors/
│  │  └─ package.json
│  ├─ db/                       # Drizzle schema, migrations, client
│  │  ├─ src/
│  │  │  ├─ schema/
│  │  │  ├─ migrations/
│  │  │  ├─ client.ts
│  │  │  └─ index.ts
│  │  ├─ drizzle.config.ts
│  │  └─ package.json
│  ├─ auth/                     # Auth.js config, JWT helpers, session types
│  │  ├─ src/
│  │  │  ├─ next-auth.config.ts
│  │  │  ├─ jwt.ts
│  │  │  └─ session.ts
│  │  └─ package.json
│  ├─ queue/                    # BullMQ queue defs, job base classes
│  │  ├─ src/
│  │  │  ├─ queues.ts
│  │  │  ├─ jobs/
│  │  │  └─ retry-policies.ts
│  │  └─ package.json
│  ├─ observability/            # Logger, metrics, tracing init
│  │  ├─ src/
│  │  │  ├─ logger.ts
│  │  │  ├─ tracer.ts
│  │  │  └─ metrics.ts
│  │  └─ package.json
│  ├─ ui/                       # Design system (shadcn-based)
│  │  ├─ src/
│  │  │  ├─ components/
│  │  │  ├─ tokens/
│  │  │  └─ index.ts
│  │  └─ package.json
│  └─ test-utils/               # Mock factories, DB test harness
│     ├─ src/
│     │  ├─ fixtures/
│     │  ├─ db-harness.ts
│     │  └─ mocks/
│     └─ package.json
├─ docs/
│  ├─ architecture/
│  ├─ adr/
│  ├─ rfc/
│  ├─ roadmap/
│  └─ diagrams/
├─ turbo.json
├─ pnpm-workspace.yaml
├─ package.json
└─ AGENTS.md
```

## Package responsibility matrix

| Package | Owns | Depends on | Owning agent |
|---|---|---|---|
| `apps/web` | Routes, pages, data fetching, UI composition | `ui`, `contracts`, `auth` | Frontend |
| `apps/api` | Controllers, service composition, DI wiring | All backend packages | Backend |
| `services/sync-worker` | Sync job consumers (accounts, transactions, classify) | `queue`, `domain`, `provider-sdk`, `db`, `observability` | Backend |
| `services/webhook-worker` | Inbound webhook verification and handlers | `queue`, `domain`, `provider-sdk`, `db`, `observability` | Backend |
| `services/scheduler` | Cron producer, repeatable job enqueuing | `queue`, `db`, `observability` | Backend |
| `packages/domain` | Entities, value objects, domain events, pure logic | Nothing | Backend |
| `packages/contracts` | Request/response schemas (Zod), OpenAPI types | `domain` | API |
| `packages/provider-sdk` | `IProviderAdapter`, registry, Plaid/MX/Akoya impls | `domain`, `contracts` | API |
| `packages/db` | Drizzle schema, migrations, client singleton | `domain` | Backend |
| `packages/queue` | Queue names, job payloads, retry policy definitions | `contracts` | Backend |
| `packages/auth` | NextAuth config, JWT sign/verify, session strategy | `db`, `domain` | Security |
| `packages/observability` | pino logger, OTEL tracer, metrics helpers | Nothing | DevOps |
| `packages/ui` | shadcn/ui components, tokens, themes | Nothing | Frontend |
| `packages/test-utils` | Mock factories, DB harness, fixture data | `db`, `domain`, `contracts` | Testing |
| `packages/config` | Shared ESLint, Prettier, TypeScript presets | Nothing | Architect / DevOps |

## Boundary rules

Boundary rules keep the dependency graph acyclic and ensure that implementation details do not leak into stable packages.

1. **Stable base packages may not import from apps or services**.
   - `packages/domain`, `packages/contracts`, `packages/observability`, and `packages/ui` form the stable base.
   - They may not import from `apps/*` or `services/*`.

2. **Depend on abstractions, not concrete implementations**.
   - Domain and service code depend on `IProviderAdapter` and repository interfaces.
   - `apps/api` is the only place that wires concrete implementations to interfaces.

3. **One bounded context per NestJS module and folder tree**.
   - The `Identity`, `ProviderLink`, `Account`, `Transaction`, `Sync`, `Budget`, `Transfer`, and `Insight` contexts each map to one module folder.

4. **No circular dependencies**.
   - `pnpm` workspace resolution and `turbo` task ordering fail the build if a cycle is introduced.

5. **Mechanical enforcement in CI**.
   - `eslint-plugin-boundaries` validates package and module boundaries on every pull request.
   - See `packages/config/eslint/boundaries.config.js` for the rule set.

## Build orchestration with Turborepo

`turbo.json` defines the task graph. Tasks are cached by content hash, so unaffected packages are skipped locally and in CI.

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local", "**/tsconfig.json"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "db:migrate": {
      "dependsOn": ["^db:generate"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### Typical commands

```bash
# Install dependencies
pnpm install

# Build everything, cached
pnpm turbo run build

# Typecheck, lint, and test in dependency order
pnpm turbo run typecheck lint test

# Run only the API and its dependencies
pnpm turbo run dev --filter=api...

# Generate and apply database migrations
pnpm turbo run db:generate db:migrate --filter=db
```

### CI pipeline

1. `pnpm install --frozen-lockfile`
2. `pnpm turbo run lint typecheck test --cache-dir=.turbo`
3. `pnpm turbo run build`
4. Deploy affected apps/services using the build outputs.

## Agent ownership and review rules

Per ADR-0000 §4, each package has a single owning agent. Cross-agent edits require review by the owning agent, coordinated by the Architect.

| Agent | Primary packages |
|---|---|
| Frontend | `apps/web`, `packages/ui` |
| Backend | `apps/api`, `services/*`, `packages/domain`, `packages/db`, `packages/queue` |
| API | `packages/contracts`, `packages/provider-sdk` |
| Security | `packages/auth` |
| DevOps | `packages/observability`, `packages/config`, deployment configs |
| Testing | `packages/test-utils`, test strategies across packages |
| Documentation | `docs/*`, Graphify updates |

When a change touches multiple packages, the Architect assigns reviewers and resolves boundary conflicts before merge.
