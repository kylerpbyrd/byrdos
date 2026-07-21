# byrdOS

AI-first personal financial operating system. Understand, automate, and optimize every aspect of your financial life.

> **Status:** Pre-release (M0–M4 complete, **M4.5 Hardening & Integration in progress**, M5–M6 planned)  
> **License:** MIT

---

## Architecture

byrdOS is a provider-agnostic financial platform. The first integration is Plaid (Varo Bank), but the architecture supports adding MX, Akoya, and direct bank APIs without refactoring.

```
apps/
├─ web/          Next.js 15 (App Router)     — user dashboard
└─ api/          NestJS 10                   — REST gateway
services/
├─ sync-worker/       BullMQ worker          — data sync pipeline
├─ webhook-worker/    BullMQ worker          — inbound provider webhooks
└─ scheduler/         BullMQ + cron          — periodic sync jobs
packages/
├─ domain/            Pure domain models (zero I/O)
├─ contracts/         Zod DTOs shared FE↔BE
├─ provider-sdk/      IProviderAdapter + Plaid adapter
├─ db/                Drizzle ORM schemas + migrations
├─ auth/              Auth.js v5 + JWT + credential encryption
├─ queue/             BullMQ job definitions
├─ observability/     pino + OTEL
├─ ui/                shadcn/ui design system (Tailwind v4)
└─ test-utils/        Test harness
```

### Tech Stack

| Layer         | Technology                                   |
| ------------- | -------------------------------------------- |
| Language      | TypeScript (strict)                          |
| Monorepo      | pnpm workspaces + Turborepo                  |
| Frontend      | Next.js 15, React 19, Tailwind v4, shadcn/ui |
| Backend       | NestJS, Passport JWT                         |
| Database      | PostgreSQL + Drizzle ORM                     |
| Cache/Queue   | Redis + BullMQ                               |
| Auth          | Auth.js v5 (Credentials + Google)            |
| Provider      | Plaid (sandbox), MX/Akoya (future)           |
| Observability | pino, OpenTelemetry                          |

---

## Getting Started

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9
- **Docker Desktop** (for Postgres + Redis)

### Quick Start

```bash
# Clone
git clone https://github.com/kylerpbyrd/byrdos.git
cd byrdos

# Copy and fill in environment variables
cp .env.example .env
# Generate required secrets and paste them into .env:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # CREDENTIAL_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # AUTH_SECRET

# Start infrastructure
docker compose up -d

# Install dependencies
pnpm install

# Apply database migrations
pnpm db:migrate

# Start everything (frontend + backend + workers)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### API Documentation

Once the API is running, OpenAPI docs are available at [http://localhost:4000/docs](http://localhost:4000/docs).

### Verify Local Setup

After `pnpm dev` is running:

1. **Containers are healthy**

   ```bash
   docker ps
   ```

   Both `postgres` and `redis` should show `(healthy)`.

2. **Dashboard loads**
   [http://localhost:3000](http://localhost:3000)

3. **API docs load**
   [http://localhost:4000/docs](http://localhost:4000/docs)

### Environment

Copy `.env.example` to `.env` and configure all required variables. See `.env.example` for inline descriptions.

```env
AUTH_SECRET=<random-32-byte-hex-string>
CREDENTIAL_ENCRYPTION_KEY=<32-byte-hex-key>
WEB_URL=http://localhost:3000
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/byrdos_dev
REDIS_URL=redis://localhost:6379
PLAID_CLIENT_ID=<your-plaid-sandbox-id>
PLAID_SECRET=<your-plaid-sandbox-secret>
PLAID_ENV=sandbox
PLAID_WEBHOOK_KEY=<your-webhook-verification-key>
```

---

## Project Structure

```
byrdos/
├─ apps/web/              Next.js frontend (port 3000)
├─ apps/api/              NestJS backend (port 4000)
├─ services/
│  ├─ sync-worker/        Data sync pipeline
│  ├─ webhook-worker/     Inbound webhooks
│  └─ scheduler/          Periodic jobs
├─ packages/
│  ├─ domain/             Pure entities, VOs, repository interfaces
│  ├─ contracts/          Zod schemas + TypeScript types
│  ├─ provider-sdk/       Provider adapters (Plaid)
│  ├─ db/                 Drizzle schemas, migrations, repositories
│  ├─ auth/               Auth.js config, JWT, encryption
│  ├─ queue/              BullMQ job definitions
│  ├─ ui/                 Design system (shadcn + Tailwind)
│  ├─ config/             Shared ESLint + Prettier
│  ├─ tsconfig/           Base tsconfigs per runtime
│  ├─ observability/      Logging + tracing
│  └─ test-utils/         Test harness + fixtures
├─ docs/
│  ├─ adr/                11 Architecture Decision Records
│  ├─ architecture/       17 design documents
│  ├─ diagrams/           7 Mermaid diagrams
│  ├─ roadmap/            Milestones M0–M6
│  └─ rfc/                RFC lifecycle + template
├─ graphify-out/          Knowledge graph
├─ docker-compose.yml     Local Postgres + Redis
└─ turbo.json             Build pipeline
```

---

## Milestones

| #    | Milestone                                                     | Status |
| ---- | ------------------------------------------------------------- | ------ |
| M0   | Foundation — monorepo, CI, package skeletons                  | ✅     |
| M1   | Identity & Auth — signup, signin, JWT, protected routes       | ✅     |
| M2   | Provider Abstraction — Plaid adapter, credential encryption   | ✅     |
| M3   | Sync Pipeline — orchestrator, workers, webhooks, scheduler    | ✅     |
| M4   | API & Read Models — endpoints, cache, events, OpenAPI         | ✅     |
| M4.5 | Hardening & Integration — API audit, README/env refresh, docs | 🚧     |
| M5   | Dashboard Frontend — accounts, transactions, Plaid Link       | 🔜     |
| M6   | Observability — metrics, tracing, rate limiting, prod deploy  | 🔜     |

See the full roadmap at [`docs/roadmap/milestones.md`](docs/roadmap/milestones.md).

---

## Design Principles

All development follows 11 binding engineering principles (ADR-0000):

1. **AI-first** — agents author code; interfaces before implementations
2. **Graphify-canonical** — knowledge graph is source of architectural truth
3. **Domain-driven design** — bounded contexts, aggregates, domain events
4. **Modular** — one agent owns each package; boundaries enforced in CI
5. **Provider-agnostic** — no provider types cross the adapter boundary
6. **Security-first** — encrypted credentials, RLS, audit logging
7. **Interface-first** — contracts published before implementations
8. **Tested** — domain ≥95%, services ≥85%, adapters ≥85%
9. **Documented** — immutable ADRs, inline Mermaid diagrams
10. **Token-optimized** — minimal context windows for agents
11. **Observability-first** — logging, metrics, tracing from day one

Read the full principles: [`docs/adr/0000-engineering-principles.md`](docs/adr/0000-engineering-principles.md)

---

## Commands

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages and apps
pnpm typecheck        # TypeScript check
pnpm lint             # ESLint
pnpm test             # Run tests
pnpm run ci           # Full CI pipeline (lint + typecheck + test + build)
pnpm db:generate      # Generate Drizzle migration
pnpm db:migrate       # Apply migrations
pnpm format:check     # Check formatting
```

---

## Documentation

- **Architecture decisions**: [`docs/adr/`](docs/adr/)
- **Architecture deep-dives**: [`docs/architecture/`](docs/architecture/)
- **Roadmap**: [`docs/roadmap/milestones.md`](docs/roadmap/milestones.md)
- **OpenAPI spec**: served live at `/docs` when `apps/api` is running

## License

byrdOS is released under the [MIT License](LICENSE).

## Contributing

byrdOS is built by specialized AI agents coordinated by the Architect. See [`AGENTS.md`](AGENTS.md) for agent responsibilities and workflows.
