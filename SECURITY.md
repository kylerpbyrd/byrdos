# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in byrdOS, please report it privately via a [GitHub Security Advisory](https://github.com/kylerpbyrd/byrdos/security/advisories/new) or by emailing the maintainers directly. Do not open public issues for undisclosed vulnerabilities.

## Secret management

- Never commit `.env` files or real secrets to the repository.
- Use `.env.example` files with placeholder values only.
- gitleaks runs in two places:
  1. **Pre-commit hook** (via husky) — scans staged changes on every commit.
  2. **CI** (`.github/workflows/gitleaks.yml`) — scans the full repository on every push.
- If a secret is accidentally committed, rotate it immediately and follow the incident response steps below.

## Incident history

### 2026-08-15 — Public `.env` leak

A `.env` file containing real secrets was committed and pushed to the public `github.com/kylerpbyrd/byrdos` repository. Remediation status:

| Secret / asset                          | Status                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Public git history                      | **Resolved** — `.env` removed from all commits via `git filter-repo` and history force-pushed. |
| `AUTH_SECRET`                           | **Rotated** locally.                                                                           |
| `PLAID_SECRET`, `PLAID_WEBHOOK_KEY`     | **Pending owner action** — rotate these sandbox credentials in the Plaid dashboard.            |
| `DATABASE_URL` / `REDIS_URL`            | **No action required** — values pointed to local dev only (`localhost`).                       |
| `CREDENTIAL_ENCRYPTION_KEY`             | **No action required** — was never in repository history (verified).                           |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | **No action required** — were placeholder values.                                              |

A full gitleaks re-scan of the rewritten history reported **no leaks found**.
