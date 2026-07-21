# byrdOS Graphify Report

> Generated: 2026-07-20  
> Method: Architectural seeding (manual, post-M0 scaffold)  
> Status: Active  
> Nodes: 95 | Edges: 68 | Communities: 10

---

## Corpus Summary

317 files detected (~430K words) across `docs/`, `packages/`, `apps/`, `services/`, and config. AST extraction unavailable due to Windows multiprocessing constraints — graph built via programmatic seeding of architectural nodes from ADRs 0000-0010 and the engineering plan.

## Communities

| #   | Community      | Nodes | Description                                             |
| --- | -------------- | ----- | ------------------------------------------------------- |
| 1   | docs           | 12    | ADRs 0000-0010 + Documentation agent                    |
| 2   | infrastructure | 10    | Config, tsconfig, observability, deployment tech        |
| 3   | domain         | 10    | Domain package, contracts, 8 bounded contexts           |
| 4   | backend        | 7     | NestJS API, db, queue, sync/webhook/scheduler workers   |
| 5   | frontend       | 5     | Next.js web app, UI package, Tailwind, shadcn           |
| 6   | auth-security  | 6     | Auth package, User/Session/Credential entities, Auth.js |
| 7   | providers      | 6     | Provider SDK, Plaid/MX/Akoya/Varo adapters              |
| 8   | data           | 15    | All 14 entities + Postgres/Drizzle/Redis/BullMQ tech    |
| 9   | testing        | 2     | Test-utils package + Testing agent                      |
| 10  | planning       | 8     | 7 milestones (M0-M6) + Architect agent                  |

## God Nodes (highest centrality)

| Node            | Type            | Connections | Why                                           |
| --------------- | --------------- | ----------- | --------------------------------------------- |
| ADR-0000        | ADR             | 10          | All other ADRs inherit from it                |
| agent-backend   | Agent           | 7           | Owns most packages + all services             |
| agent-architect | Agent           | 7           | Owns all milestones + coordinates             |
| pkg-domain      | Package         | 6           | Core dependency for most packages             |
| ctx-sync        | Bounded Context | 6           | Orchestrates accounts + transactions + events |
| ADR-0001        | ADR             | 5           | Describes monorepo stack decisions            |

## Surprising Connections

- **agent-indexer → (no edges yet)**: Indexer agent exists but has no ownership assignments — needs M1+ to assign Graphify update tasks
- **Budget/Transfer/Insight contexts**: Three bounded contexts planned for v2/v3 but unconnected to any entity or package — intentional future-proofing
- **All 10 ADRs inherit from ADR-0000**: The inheritance graph is a perfect star, reflecting the architectural discipline required by §9

## Suggested Questions

1. "What packages does the Backend agent own?"
2. "Which entities belong to the Sync bounded context?"
3. "What is the critical path from M0 to M6?"
4. "Which ADRs describe the provider abstraction pattern?"
5. "What technologies does the db package depend on?"
6. "Trace the data flow from ProviderLink → Account → Transaction"
7. "Show all relationships for ADR-0000"
8. "Which agents are assigned to M2 (Provider Abstraction + Plaid)?"
9. "What queues does the sync-worker consume?"
10. "How does the outbox eventing pattern connect bounded contexts?"

## Token Cost

| Component           | Input Tokens | Output Tokens      |
| ------------------- | ------------ | ------------------ |
| Detection           | 0            | 0                  |
| AST Extraction      | 0            | 0 (Windows issue)  |
| Semantic Extraction | 0            | 0 (manual seeding) |
| **Total this run**  | **0**        | **0**              |

> Note: Graph built via programmatic seeding rather than full Graphify pipeline due to Windows multiprocessing constraints. Full pipeline will be run on a Linux CI runner in M1+.

## Integrity Notes

- All 11 ADRs are linked to their source files
- All package ownership relationships are captured
- Entity → bounded context relationships are mapped
- Queue → service → agent relationships are traced
- Milestone dependency chain is preserved
- Future run: re-run full Graphify pipeline on Linux for AST extraction of implementation code
