# RFC Lifecycle

This document defines the RFC (Request for Comments) lifecycle for byrdOS and provides the template that all new RFC proposals must follow.

## 1. RFC Lifecycle

RFCs are pre-decision proposals. They are **not binding** until they are promoted to an Architecture Decision Record (ADR). Promotion from RFC to ADR requires explicit user approval and cannot be automated.

| Stage | Status field | Meaning |
|---|---|---|
| 1 | Proposed | Submitted for review; not binding |
| 2 | Review | Architect + relevant specialized agents evaluating |
| 3 | Accepted | Becomes a new ADR (e.g., RFC-0007 → ADR-0011) — **requires user approval** |
| 4 | Rejected | Archived with rationale; drift reference |
| 5 | Withdrawn | Author pulled the proposal |

The acceptance gate at Stage 3 cannot be automated. It requires explicit user approval per ADR-0000.

## 2. RFC Naming Convention

- RFCs are numbered independently from ADRs: `rfc-NNNN-title-slug.md`
- Numbers are zero-padded to four digits (e.g., `rfc-0001-provider-fanout.md`)
- The title slug is lowercase kebab-case

## 3. RFC Template

New RFC authors should copy this template into a new file named according to the convention above.

```markdown
# RFC-NNNN: [Title]

| Field | Value |
|---|---|
| Status | Proposed |
| Date | YYYY-MM-DD |
| Author | [Agent/Name] |
| Supersedes | — |
| Related ADRs | [ADR-0000, ADR-0005, etc.] |
| Implements | [ADR-0000 §X principle name] |

## Summary
[One paragraph explaining what this RFC proposes]

## Motivation
[Why is this needed? What problem does it solve?]

## Proposed Solution
[Detailed technical proposal with tradeoffs considered]

## Alternatives Considered
[What other approaches were evaluated and why rejected?]

## Impact Assessment
- **Packages affected:** [list]
- **Agents affected:** [list]
- **Migration required:** [yes/no; if yes, describe]
- **Breaking changes:** [yes/no; if yes, describe]
- **ADR changes required:** [list of ADRs that would need updates or superseding]

## Approval
- [ ] Architect review
- [ ] [Specialized agent] review
- [ ] User approval (required for Stage 3 promotion)
```

## 4. Active RFCs

| # | Title | Status | Author | Date |
|---|---|---|---|---|
| — | — | — | — | — |

This table should be updated when new RFCs are proposed.

## 5. Promoted RFCs

| RFC | Promoted to ADR | Date | Rationale |
|---|---|---|---|
| — | — | — | — |

## 6. Rejected RFCs

| RFC | Title | Date Rejected | Rationale |
|---|---|---|---|
| — | — | — | — |
