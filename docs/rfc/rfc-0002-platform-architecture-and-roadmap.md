# RFC-0002: Platform Architecture and Roadmap

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-08-16 |
| Author | Documentation Agent (byrdOS) |
| Acceptance required from | User |
| Became ADR | — |
| Supersedes | — |
| Related ADRs | ADR-0000, ADR-0014 |

## Summary

This RFC proposes a strategic reframing of byrdOS: from a single "bank account syncing" app into a self-hosted application platform — "an OS for multiple apps to live side by side." Multiple self-built apps (starting with Finance and Fertility) will share one Next.js shell, one auth system, one design system, and one self-hosted deployment path.

## Context

byrdOS has reached a point where the initial financial-data integration (Plaid/Varo sync, accounts, transactions, dashboard) is functional. The owner has confirmed that the product should now evolve into a multi-app platform. This changes the shape of the codebase, the roadmap, and the criteria for "V1.0."

## Problem

Continuing to build every feature inside a single `apps/web` finance application will:

- Force each new domain (health, productivity, etc.) to re-implement shell concerns (auth, navigation, layout, design tokens, settings, notifications).
- Make it harder to self-host a consistent, upgradeable product.
- Lock the project into a "finance-only" identity before the platform direction is confirmed.

A deliberate platform architecture is needed before the next wave of features begins.

## Proposal / Decision

### Reframe

byrdOS is evolving from a single "bank account syncing" app into a self-hosted application *platform* ("an OS for multiple apps to live side by side"). Multiple self-built apps (Finance, Fertility, …) will share one shell, one auth system, one design system, and one self-hosted deployment.

### Decision 1 — Platform architecture (single shell + apps/*)

- A single Next.js shell hosts multiple app modules in `apps/*` (e.g. `apps/finance`, `apps/fertility`).
- An **app registry/manifest** lets each app declare id, name, icon, routes, nav, and permissions; the shell renders the app switcher + global nav.
- **SSO** across apps (existing next-auth + API JWT, extended with app-level scoping).
- Shared: design system (`packages/ui`), data layer, queues, observability, settings, notifications.
- Reject micro-frontends / separate deployables as overkill for a self-hosted product.

### Decision 2 — Finance app scope (analytics-first, not budgeting)

- Analytics/observability-heavy: **subscriptions/recurring detection**, **transaction categorization** (wire the stubbed `classify` queue; Plaid `personal_finance_category` seed + local rules + manual override), **spend insights/trends** (spend by category/merchant/month, month-over-month).
- Explicitly NOT an envelope/zero-based budgeting tool like Actual Budget (no "every dollar has a job" allocation).
- Data-analytics note: SQL aggregations over transactions; balance history snapshots already exist → net-worth trend is cheap.

### Decision 3 — Design system

Adopt the Notion design language (warm paper canvas, near-black tight-tracked Inter, single blue accent #0075de, hairline + micro-shadow elevation, pill CTAs) via the installed `DESIGN.md`.

### Decision 4 — Fertility app

A second app, developed by the owner and integrated later; the platform must be prepared to host it (privacy-first data handling for health data).

### Decision 5 — Self-hosted & public

Docker Compose as the canonical self-host path; polished README/install/backup/upgrade docs; public repo for self-hosters.

### Decision 6 — Defer external account wiring

Fly.io/Neon/Upstash (ADR-0014) are wired but deferred until V1.0; local/sandbox until then.

## Roadmap

| Phase | Focus | Key outcomes |
|---|---|---|
| P1 | Design refresh | Apply Notion-style design language across the shared shell and existing Finance UI; update `DESIGN.md` compliance. |
| P2 | Platform refactor | Introduce `apps/*` modules, app registry/manifest, shell routing, and cross-app SSO scoping. |
| P3 | Finance analytics | Recurring detection, transaction categorization (`classify` queue wired), spend insights/trends, net-worth history. |
| P4 | Fertility app | Integrate the owner-built Fertility app; verify privacy-first health-data handling. |
| P5 | Self-host polish | Docker Compose quickstart, install/backup/upgrade runbooks, public repo hygiene. |
| P6 | V1.0 | Enable external-account wiring (Fly.io/Neon/Upstash per ADR-0014) and cut the release. |

## Consequences

- **Positive**: One shell and one auth system reduces duplication as new apps are added.
- **Positive**: A shared design system makes the product feel cohesive and premium.
- **Positive**: Docker Compose self-hosting gives users full data ownership and simplifies public release.
- **Positive**: Deferring paid external infrastructure keeps local development and early self-hosting free.
- **Negative**: The platform refactor is a non-trivial structural change that will touch routing, auth, and package boundaries.
- **Negative**: A shared shell increases blast radius — a shell regression affects every app.
- **Neutral**: The existing Finance dashboard becomes the first app module; its business logic is preserved.

## Alternatives considered

- **Micro-frontends or separate deployables per app** — rejected as overkill for a self-hosted product; a single shell with `apps/*` modules gives enough isolation without the operational complexity.
- **Envelope/zero-based budgeting for Finance** — rejected; the owner confirmed an analytics/observability direction, not allocation-based budgeting.
- **A different design language or ad-hoc styling** — rejected; the Notion direction is already captured in `DESIGN.md` and confirmed by the owner.
- **Separate auth systems per app** — rejected; SSO across apps is a core platform benefit.
- **Wiring Fly.io/Neon/Upstash before V1.0** — rejected; local/sandbox is sufficient until the public release, per ADR-0014.

## Open questions

1. **App-manifest schema** — What is the canonical shape of the app registry/manifest (Zod schema, runtime discovery, build-time generation)?
2. **Per-app DB isolation** — Do apps share one database schema namespace with prefixed tables, or should each app have a separate schema/module boundary enforced by `eslint-plugin-boundaries`?
3. **App-level permissions** — How are app-level scopes represented in the JWT/session, and how does the shell enforce them?
4. **Cross-app notifications** — Should notifications be owned by the shell or by individual apps, and how is routing/deduplication handled?
5. **Health-data privacy** — What specific encryption, access-control, and audit requirements apply to Fertility app data before integration?
6. **Shell/app version contract** — What is the compatibility/upgrade policy when the shell outpaces an app module or vice versa?
7. **V1.0 re-entry criteria** — What user-count, stability, or self-hoster feedback thresholds trigger enabling Fly.io/Neon/Upstash and cutting V1.0?

## Impact assessment

- **Packages affected**: `apps/web` (becomes shell), new `apps/*` modules, `packages/ui`, `packages/auth`, `packages/contracts`, `packages/db`, `packages/observability`.
- **Agents affected**: Architect, Frontend, Backend, API, Security, DevOps, Documentation.
- **Migration required**: Yes — refactor routes/components into `apps/finance`, build app registry, extend auth scoping, and add Docker Compose self-host documentation.
- **Breaking changes**: Yes — URL structure and possibly JWT/session claims will change as the shell takes over top-level routing.
- **ADR changes required**: None at this stage; this RFC, if accepted, becomes a new ADR. ADR-0014 remains in force and is intentionally deferred per Decision 6.

## Approval

- [ ] Architect review
- [ ] Frontend Agent review
- [ ] Backend Agent review
- [ ] User approval (required for promotion to ADR)
