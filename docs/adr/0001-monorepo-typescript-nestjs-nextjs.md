# ADR-0001: Monorepo, TypeScript, NestJS, Next.js

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-20 |
| Author | Architect (byrdOS) |
| Supersedes | — |
| Superseded by | — |
| Inherits | ADR-0000 |
| Implements | §1 AI-first, §4 Modular architecture, §10 Token optimization |

## 1. Context

byrdOS needs a single-language full-stack codebase that specialized AI agents can navigate efficiently. A unified stack reduces context-switching cost across agents, eliminates serialization mismatches between frontend and backend, and lets a single agent make atomic changes that span the API, domain, and UI. The monorepo enables shared contracts, consistent tooling, and atomic cross-package changes.

This ADR applies ADR-0000 §1 (AI-first development), §4 (modular architecture and clear ownership boundaries), and §10 (token optimization) by selecting technologies and a package layout that keep agent context windows small and responsibilities explicit.

## 2. Decision

The following technology choices are locked for the byrdOS platform:

| Area | Decision | Rationale |
|---|---|---|
| Language | TypeScript (strict mode) | Single language across entire stack; explicit types aid agent comprehension and contract reuse. |
| Monorepo tool | pnpm workspaces + Turborepo | Fast, incremental builds; Turborepo can skip unaffected packages and cache tasks across CI and local environments. |
| Backend framework | NestJS | Modular DDD with built-in dependency injection, guards, pipes, and interceptors. |
| Frontend framework | Next.js App Router | React Server Components, streaming, file-based routing, and colocated API consumption. |
| Package manager | pnpm | Strict, fast, workspace-native; disk-space efficient via content-addressable store. |
| Styling | Tailwind v4 + shadcn/ui | Design tokens, accessible primitives, and tree-shakeable utility classes. |
| License | MIT | Open by default. |

## 3. Monorepo Structure

```
byrdos/
├─ apps/
│  ├─ web/                      # Next.js (App Router)
│  └─ api/                      # NestJS REST gateway
├─ services/
│  ├─ sync-worker/              # BullMQ worker process
│  ├─ webhook-worker/           # Inbound provider webhooks
│  └─ scheduler/                # Cron producer
├─ packages/
│  ├─ config/                   # eslint, tsconfig, prettier shared
│  ├─ tsconfig/                 # base tsconfigs per runtime
│  ├─ domain/                   # Pure domain models, VOs, events (no I/O)
│  ├─ contracts/                # OpenAPI / Zod DTOs shared FE↔BE
│  ├─ provider-sdk/             # Aggregator adapters + common interface
│  ├─ db/                       # Drizzle schema, migrations, client
│  ├─ auth/                     # Auth.js config, JWT helpers, session types
│  ├─ queue/                    # BullMQ queue defs, job base classes
│  ├─ observability/            # Logger (pino), metrics, tracing init
│  ├─ ui/                       # Design system (shadcn-based)
│  └─ test-utils/               # Mock factories, db test harness
├─ docs/
│  ├─ architecture/
│  ├─ adr/
│  ├─ rfc/
│  ├─ roadmap/
│  └─ diagrams/
├─ turbo.json
├─ pnpm-workspace.yaml
└─ AGENTS.md
```

## 4. Package responsibility matrix

| Package | Owns | Depends on | Agent |
|---|---|---|---|
| domain | Entities, VOs, domain events, pure logic | nothing | Backend |
| contracts | Request/response schemas (Zod), OpenAPI types | domain | API |
| provider-sdk | IProviderAdapter + Plaid/MX/Akoya impls | domain, contracts | API |
| db | Schema (Drizzle TS), migrations, client singleton | domain | Backend |
| queue | Queue names, job payloads, retry policy defs | contracts | Backend |
| auth | NextAuth config, JWT sign/verify, session strategy | db, domain | Security |
| observability | pino logger, OTEL tracer, metrics helpers | nothing | DevOps |
| ui | shadcn/ui components, tokens, themes | nothing | Frontend |
| apps/api | Controllers, service composition, DI wiring | all BE packages | Backend |
| services/* | Long-running processes | queue, domain, provider-sdk | Backend |
| apps/web | Routes, pages, data fetching | ui, contracts, auth | Frontend |

## 5. Boundary rules

- `domain`, `contracts`, `observability`, and `ui` may not import from `apps/` or `services/`. These packages form the stable base of the dependency graph.
- `apps/api` is the only place that wires concrete implementations to interfaces. Domain and service code must depend on abstractions (`IProviderAdapter`, repository interfaces), not concrete implementations.
- Boundaries are enforced mechanically by `eslint-plugin-boundaries` in CI, as required by ADR-0000 §4.
- Circular dependencies between packages are prohibited. `pnpm` workspace resolution and `turbo` task ordering will fail the build if a cycle is introduced.

## 6. Consequences

- **Positive**: A single language across the stack reduces agent context-switching cost and lets shared types flow from `packages/contracts` to both frontend and backend.
- **Positive**: Shared contracts eliminate frontend/backend type drift; DTOs authored once are consumed by NestJS controllers and Next.js data fetching.
- **Negative**: All implementation agents must be fluent in TypeScript, including strict mode and module resolution rules.
- **Negative**: pnpm workspaces plus Turborepo add build orchestration complexity. This is mitigated by `packages/config` centralizing ESLint, Prettier, and TypeScript presets so that each app and service inherits tooling rather than redefining it.

## 7. Changelog

| Date | Change | Author |
|---|---|---|
| 2026-07-20 | Accepted monorepo stack decisions | Architect (byrdOS) |
