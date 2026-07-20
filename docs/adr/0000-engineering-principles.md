# ADR-0000: Engineering Principles

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-20 |
| Author | Architect (byrdOS) |
| Supersedes | — |
| Superseded by | — |
| Inherits | — (root ADR) |

## Principles

### 1. AI-first development

Code and docs authored primarily by specialized agents. Interfaces, contracts, tests written before impl bodies. Optimized for agent comprehension: small files, single responsibility, explicit types, predictable patterns, no clever abstractions. All edits retain audit trail (git log).

- Specialized agents own discrete concerns (API, Backend, Frontend, Security, DevOps, Testing, Documentation).
- Contracts and tests are produced before implementation bodies are written.
- Source files are kept small and focused on a single responsibility.
- Explicit types and predictable patterns are preferred over clever or implicit abstractions.
- Every edit must be traceable through git history.

### 2. Graphify as canonical architectural memory

Graphify is source of truth for components, services, relations, decisions. Every significant change MUST have a Graphify update task. Implementation agents consult Graphify before reading source; read source only for specific references Graphify returns. Stale Graphify state is a defect.

- Components, services, APIs, database entities, relationships, decisions, and ownership are modeled in Graphify.
- A Graphify update task is required for every significant architectural or implementation change.
- Agents query Graphify first and limit source reads to the files Graphify identifies.
- Out-of-date Graphify entries are treated as bugs and remediated before dependent work proceeds.

### 3. Domain-driven design

Every feature inside a bounded context; cross-context calls via domain events, never direct service imports. Aggregates are consistency boundaries; repositories persist one aggregate per transaction. Domain package (packages/domain) has zero I/O and zero framework imports — the only layer a junior agent can read in isolation.

- Each feature lives inside exactly one bounded context.
- Bounded contexts communicate through domain events, not direct service imports.
- Aggregates define consistency boundaries.
- Repositories persist exactly one aggregate per transaction.
- The `packages/domain` package contains no I/O and no framework dependencies.

### 4. Modular architecture and clear ownership boundaries

Each bounded context is one NestJS module and one folder tree. Each package has a single owning agent; edits by others require that owning agent's review (Architect coordinates). Boundaries enforced mechanically by eslint-plugin-boundaries in CI. No circular dependencies between packages or modules.

- One bounded context maps to one NestJS module and one folder tree.
- Each package is owned by a single agent; cross-agent edits require owner review.
- The Architect coordinates reviews and resolves boundary conflicts.
- `eslint-plugin-boundaries` enforces package and module boundaries in CI.
- Circular dependencies between packages or modules are prohibited.

### 5. Provider-agnostic integrations

No provider-specific type or concept crosses the IProviderAdapter boundary. First concrete adapter (Plaid) MUST be implemented without any Plaid-specific field surfacing in services, DTOs, or domain. Adding a second provider MUST be possible by introducing a new adapter file and registering it — no service or schema change.

- Provider-specific types and concepts stop at the adapter boundary.
- The Plaid adapter exposes no Plaid-specific fields in services, DTOs, or domain models.
- A second provider is added by creating a new adapter file and registering it.
- No service, schema, or domain change is required to add or swap providers.

### 6. Security-first development

Threat model reviewed at every milestone gate (Architect + Security). Secrets never logged, never committed, never returned in API responses; pino redaction paths mandatory. Credentials/tokens stored as envelope-encrypted blobs; encryption key never in database. Every user-facing endpoint enforces per-user authorization; multi-tenancy isolation checked in tests. Destructive DB changes require explicit human approval.

- Threat modeling is performed at every milestone gate by the Architect and Security agent.
- Secrets are never logged, committed, or returned in API responses.
- Pino redaction paths are mandatory for all sensitive fields.
- Credentials and tokens are stored as envelope-encrypted blobs; the encryption key is never stored in the database.
- Every user-facing endpoint enforces per-user authorization.
- Multi-tenancy isolation is verified by automated tests.
- Destructive database changes require explicit human approval.

### 7. Interface-first design

Cross-package/cross-service interactions: interface lives in contracts/domain, published before implementations. Implementation agents receive interface + matching test contract; never invent interfaces unless ADR delegates that authority. OpenAPI generated from contracts/DTOs, not hand-written.

- Interfaces for cross-package and cross-service interactions live in `contracts/domain`.
- Interfaces and matching test contracts are published before implementation begins.
- Implementation agents do not invent new interfaces unless an ADR explicitly delegates that authority.
- OpenAPI specifications are generated from contracts and DTOs, not authored by hand.

### 8. Testing requirements

No PR merges without affected tests passing under turbo cache miss. Coverage: domain ≥95%, repositories/services ≥85%, adapters ≥85% with fixture-driven HTTP mocks, e2e for critical human flows. Tests use ephemeral Postgres schemas; no shared test database. Tests deterministic; no time/clock reliance without injected clock abstraction.

- Pull requests cannot merge unless all affected tests pass under a turbo cache miss.
- Domain coverage must be at least 95%.
- Repository and service coverage must be at least 85%.
- Adapter coverage must be at least 85% using fixture-driven HTTP mocks.
- End-to-end tests cover critical human flows.
- Tests use ephemeral Postgres schemas; no shared test database is permitted.
- Tests must be deterministic and must not rely on the system clock without an injected clock abstraction.

### 9. Documentation standards

Every significant decision recorded in immutable ADR; ADRs never edited after Accept — superseding ADR authored instead. Module-level READMEs only when wiring non-obvious; otherwise see ADR-0000 + Graphify. Mermaid diagrams inline in .md (GitHub-renderable). Public API spec at /docs (OpenAPI) generated from code.

- Every significant decision is recorded in an immutable ADR.
- Accepted ADRs are never edited; changes require a new superseding ADR.
- Module-level READMEs are written only when wiring is non-obvious.
- Mermaid diagrams are authored inline in Markdown for GitHub rendering.
- The public API specification at `/docs` is generated from code, not maintained manually.

### 10. Token optimization

Agents load only Graphify-referenced files, never full tree walk. File scope per implementation task bounded; Architect ensures context windows stay minimal. Reuse existing DTOs, events, types rather than paraphrasing. Avoid re-reading unchanged files; trust Graphify's lastUpdated metadata.

- Agents read only the files Graphify references for a given task.
- Full repository tree walks are avoided.
- The Architect bounds the file scope for each implementation task.
- Existing DTOs, events, and types are reused instead of paraphrased.
- Unchanged files are not re-read; agents trust Graphify `lastUpdated` metadata.

### 11. Observability-first engineering

Observability designed in alongside features, not bolted on after. Every service exposes structured logs (pino), metrics, and OTEL traces from day one. Every cross-context call and external provider call is a span boundary. Alert targets and SLOs defined before milestone exits M-Stage.

- Observability is designed as part of each feature, not added later.
- Every service exposes structured logs via pino, metrics, and OpenTelemetry traces from the start.
- Cross-context calls and external provider calls are treated as span boundaries.
- Alert targets and SLOs are defined before a milestone exits the M-Stage.

## Consequences

- Slower initial velocity in M0/M1, faster from M2 onward.
- Higher discipline overhead at every PR; repaid in agent handoff efficiency and fewer regressions.
- Future ADRs defer to these principles; any exception MUST cite the principle being overridden and require explicit Architect approval.

## How to inherit this ADR

Any ADR numbered 0001 or higher must include in its metadata header:

```
Inherits: ADR-0000
```

In addition, the ADR should cite the specific principles it implements, for example:

```
Implements: §2 Graphify-canonical, §5 Provider-agnostic
```

Inherited principles are not redefined in the child ADR; the child ADR refers back to this document and explains only the concrete application of the relevant principles to the decision at hand.

## Changelog

| Date | Change | Author |
|---|---|---|
| 2026-07-20 | Accepted foundational engineering principles | Architect (byrdOS) |
