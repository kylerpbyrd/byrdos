# byrdOS API Load Tests (k6)

This directory contains k6 load-test scripts for the byrdOS API.

## Endpoints covered

- Public: `GET /health/ready`, `GET /metrics`
- Authenticated: `GET /api/accounts`, `GET /api/transactions`

Each script authenticates once in `setup()` via `POST /api/auth/signin` and reuses the bearer token for all authenticated requests.

## Scripts

- `k6-smoke.js` — 5 VUs for 30 seconds. Basic health/accounts/transactions smoke test.
- `k6-load.js` — staged ramp (20 VUs → 50 VUs over 1 minute, hold 2 minutes, ramp down). Includes p95 < 500 ms and error-rate < 1% thresholds.

## Run locally with Docker

From the repository root:

```bash
# Smoke test
docker run --rm -i grafana/k6 run - < tests/load/k6-smoke.js

# Load test
docker run --rm -i grafana/k6 run - < tests/load/k6-load.js
```

Or mount the directory:

```bash
docker run --rm -v "${PWD}/tests/load:/scripts" grafana/k6 run /scripts/k6-smoke.js
```

## Environment overrides

| Variable | Default |
|---|---|
| `API_BASE` | `http://localhost:4000` |
| `TEST_EMAIL` | `m5-live2@byrdos.test` |
| `TEST_PASSWORD` | `Passw0rd!123` |

Pass them with `-e`:

```bash
docker run --rm -i -e API_BASE=http://host.docker.internal:4000 \
  -e TEST_EMAIL=m5-live2@byrdos.test \
  -e TEST_PASSWORD=Passw0rd!123 \
  grafana/k6 run - < tests/load/k6-smoke.js
```

## Validation / syntax check

```bash
docker run --rm -i grafana/k6 inspect - < tests/load/k6-smoke.js
docker run --rm -i grafana/k6 inspect - < tests/load/k6-load.js
```

`inspect` parses the script without making network requests. Exit code `0` means the script is valid.
