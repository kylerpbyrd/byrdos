# Developer Experience

byrdOS is optimized for specialized agents to work independently with minimal context. This document defines folder and naming conventions, code standards, documentation strategy, Graphify knowledge graph structure, the RFC lifecycle, agent responsibilities, and recommended starter prompts.

This document inherits ADR-0000 §1 (AI-first development), §2 (Graphify as canonical memory), §4 (modular architecture), §9 (documentation standards), and §10 (token optimization).

## Folder and naming conventions

### Folder structure

```
<package>/
├─ src/
│  ├─ <context>/                 # bounded context
│  │  ├─ <entity>.ts             # aggregate root or entity
│  │  ├─ <entity>.repository.ts  # repository interface
│  │  ├─ <entity>.errors.ts      # domain errors
│  │  ├─ <entity>.events.ts      # domain events
│  │  ├─ index.ts                # public exports
│  │  └─ __tests__/              # colocated tests
│  └─ index.ts
├─ package.json
└─ tsconfig.json
```

### Naming conventions

| Item | Convention | Example |
|---|---|---|
| Files | kebab-case | `sync-job.repository.ts` |
| Classes | PascalCase | `SyncJobRepository` |
| Interfaces | PascalCase with `I` prefix | `ISyncJobRepository` |
| Functions | camelCase | `createSyncJob` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| Injection tokens | Symbol with descriptive name | `ISYNC_JOB_REPOSITORY` |
| Environment variables | UPPER_SNAKE_CASE | `DATABASE_URL` |

### Imports

- Prefer absolute imports within a package.
- Cross-package imports use the package name (e.g., `@byrdos/domain`).
- No relative imports that cross package boundaries.

## Code standards

### ESLint

Shared ESLint config in `packages/config/eslint/` enforces:

- TypeScript strict rules
- Import order
- `eslint-plugin-boundaries` for package/module boundaries
- No circular dependencies

### Prettier

Shared Prettier config in `packages/config/prettier/` enforces consistent formatting.

### TypeScript

- Strict mode enabled.
- `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes` required.
- `skipLibCheck: true` for faster builds.

### Pre-commit

- `lint-staged` runs ESLint and Prettier on changed files.
- Type checking runs in CI, not necessarily pre-commit.

## Documentation strategy

- **ADRs**: Every significant decision is recorded as an immutable ADR in `docs/adr/`.
- **Architecture docs**: Long-form cross-cutting docs live in `docs/architecture/`.
- **RFCs**: Pre-decision proposals live in `docs/rfc/`.
- **Module READMEs**: Written only when wiring is non-obvious.
- **Mermaid diagrams**: Inline in Markdown files.
- **OpenAPI**: Generated from code and served at `/docs`.

## Graphify knowledge graph

Graphify is the project's canonical architectural memory. It models entities and relationships so agents can query before reading source.

### Node types

| Type | Examples |
|---|---|
| `Component` | `AccountRepository`, `PlaidAdapter` |
| `Service` | `SyncAccountsService`, `AccountsWorker` |
| `API` | `GET /accounts`, `POST /links/exchange` |
| `DatabaseEntity` | `accounts`, `transactions` |
| `Event` | `account.accounts-synced` |
| `Decision` | `ADR-0001`, `ADR-0003` |
| `Agent` | `Backend`, `Frontend`, `Security` |
| `Package` | `packages/domain`, `apps/api` |

### Edge types

| Type | Meaning |
|---|---|
| `OWNS` | Agent owns a package or component |
| `DEPENDS_ON` | Component depends on another |
| `CALLS` | Service calls API or another service |
| `PERSISTS` | Repository persists entity |
| `EMITS` | Aggregate or service emits event |
| `HANDLES` | Handler reacts to event |
| `REFERENCES` | Document references ADR |
| `IMPLEMENTED_BY` | Interface implemented by concrete class |

### Usage

Agents query Graphify before reading source:

```
Which components depend on IProviderAdapter?
What events does AccountsWorker emit?
Show the path from /links/exchange to SyncJob.
```

Every significant architectural or implementation change requires a Graphify update task, coordinated with the Indexer worker agent.

## RFC lifecycle

RFCs are pre-decision proposals. They become ADRs only after explicit user approval.

| Stage | Status | Meaning |
|---|---|---|
| 1 | Proposed | Submitted for review |
| 2 | Review | Under evaluation |
| 3 | Accepted | Becomes an ADR (requires user approval) |
| 4 | Rejected | Archived |
| 5 | Withdrawn | Author pulled |

See `docs/rfc/README.md` for the template and active RFCs.

## Agent responsibilities

| Agent | Responsibilities | Primary packages |
|---|---|---|
| **Architect** | Planning, coordination, roadmaps, Graphify, reviews | All |
| **API Agent** | External APIs, OAuth, webhooks, SDKs | `packages/provider-sdk`, `packages/contracts` |
| **Backend Agent** | Services, business logic, database, queues | `apps/api`, `services/*`, `packages/domain`, `packages/db`, `packages/queue` |
| **Frontend Agent** | React, Next.js, UI, UX | `apps/web`, `packages/ui` |
| **Testing Agent** | Unit, integration, regression tests | `packages/test-utils`, test strategies |
| **Security Agent** | Auth, authz, secrets, security reviews | `packages/auth`, security controls |
| **DevOps Agent** | Docker, CI/CD, infrastructure, monitoring | `packages/observability`, deployment configs |
| **Documentation Agent** | ADRs, architecture docs, Graphify updates | `docs/*` |

Cross-agent edits require review by the owning agent, coordinated by the Architect.

## Recommended starter prompts

### Architect

> Plan the next milestone for adding MX as a second provider. Identify affected bounded contexts, ADRs to write or supersede, and Graphify nodes to update.

### Backend Agent

> Implement the `SyncCursor` repository interface in `packages/db` following the existing `AccountRepository` pattern. Add tests using the shared Postgres harness.

### Frontend Agent

> Add a transactions list page at `/transactions` using TanStack Query, the existing `DataTable` component, and the contracts from `packages/contracts`.

### API Agent

> Add webhook signature verification to the Plaid adapter. Define the provider-neutral `WebhookVerificationInput` in `packages/contracts`.

### Security Agent

> Review the JWT verification guard in `apps/api` and the refresh-token rotation flow. Identify redaction gaps in pino configuration.

### Testing Agent

> Write fixture-driven adapter tests for Plaid `fetchTransactions` with cursor pagination and rate-limit responses.

### DevOps Agent

> Add a GitHub Actions workflow that runs `pnpm turbo run lint typecheck test --force` on every pull request.

### Documentation Agent

> Create an ADR for adding Redis Streams as the integration event broker, inheriting ADR-0000 §3 and §11.

## Consequences

- **Positive**: Conventions reduce decision fatigue and keep the codebase predictable.
- **Positive**: Graphify minimizes the context agents need to load.
- **Negative**: Strict conventions require onboarding for new agents.
- **Negative**: Graphify must be kept current; stale entries are treated as defects.
