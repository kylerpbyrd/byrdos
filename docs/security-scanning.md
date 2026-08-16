# Security Scanning Runbook

Local commands for running OWASP ZAP and k6 against the API at `http://localhost:4000`.

## Prerequisites

- Docker running locally.
- API running on port 4000 (e.g. `pnpm --filter api dev` or via `docker compose up`).
- On Windows, `host.docker.internal` reaches the host machine from Docker Desktop containers. On Linux, you may need `--add-host=host.docker.internal:host-gateway` or use the host IP instead.

## OWASP ZAP baseline scan

PowerShell:

```powershell
docker run --rm -v "$((Get-Location).Path):/zap/wrk" -t zaproxy/zap-stable zap-baseline.py -t http://host.docker.internal:4000 -r zap-report.html
```

Bash:

```bash
docker run --rm -v "$(pwd):/zap/wrk" -t zaproxy/zap-stable zap-baseline.py -t http://host.docker.internal:4000 -r zap-report.html
```

The HTML report is written to `zap-report.html` in the current directory.

## k6 load tests

Smoke test:

```powershell
Get-Content tests/load/k6-smoke.js -Raw | docker run --rm -i -e API_BASE=http://host.docker.internal:4000 grafana/k6 run -
```

Load test:

```powershell
Get-Content tests/load/k6-load.js -Raw | docker run --rm -i -e API_BASE=http://host.docker.internal:4000 grafana/k6 run -
```

Bash equivalent:

```bash
docker run --rm -i -e API_BASE=http://host.docker.internal:4000 grafana/k6 run - < tests/load/k6-smoke.js
docker run --rm -i -e API_BASE=http://host.docker.internal:4000 grafana/k6 run - < tests/load/k6-load.js
```

## CI workflows

- `.github/workflows/zap-scan.yml` — manual ZAP baseline scan against a configurable target URL.
- `.github/workflows/k6-load.yml` — manual k6 smoke/load run against a configurable `API_BASE`.

> Both workflows are gated on a reachable staging host. They are not scheduled automatically until deployment is wired up.
