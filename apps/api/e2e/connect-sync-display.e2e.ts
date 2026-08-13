import { describe, test } from 'vitest';
import { spawn, execFile, execSync } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const API_READY_URL = `${API_URL}/health/ready`;
const DB_NAME = 'byrdos_dev';

function findEnvFile(): string | undefined {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

function loadEnv() {
  const envPath = findEnvFile();
  if (!envPath) return;
  try {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const [, key, value] = match;
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env is optional when env is already injected
  }
}

loadEnv();

const ENABLED = process.env.PLAID_LIVE_SANDBOX_E2E === 'true';
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID ?? '';
const PLAID_SECRET = process.env.PLAID_SECRET ?? '';

function hasCreds(): boolean {
  return PLAID_CLIENT_ID.length > 0 && PLAID_SECRET.length > 0;
}

function containerRunning(name: string): boolean {
  try {
    const output = execSync(`docker ps -q -f name=${name} -f status=running`, { encoding: 'utf8' });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

async function waitForReady(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown = 'not checked';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      last = res.status;
    } catch (err) {
      last = err;
    }
    await sleep(1_000);
  }
  throw new Error(`Health endpoint ${url} did not become ready: ${String(last)}`);
}

async function apiFetch<T = unknown>(
  pathname: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: T }> {
  const headers = new Headers(init.headers ?? {});
  headers.set('Content-Type', 'application/json');
  if (init.token) {
    headers.set('Authorization', `Bearer ${init.token}`);
  }
  const res = await fetch(`${API_URL}${pathname}`, { ...init, headers });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

function killProcess(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F']);
      killer.on('error', () => resolve());
      killer.on('close', () => resolve());
    } else {
      child.kill('SIGTERM');
      const t = setTimeout(() => child.kill('SIGKILL'), 10_000);
      child.on('exit', () => {
        clearTimeout(t);
        resolve();
      });
    }
  });
}

async function pollSyncCompleted(
  connectionId: string,
  token: string,
  timeoutMs = 180_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await apiFetch<{
      recentJobs?: Array<{ status: string; error?: string }>;
    }>(`/api/sync/${connectionId}`, { token });
    const jobs = res.body.recentJobs ?? [];
    if (jobs.some((j) => j.status === 'completed')) return;
    if (jobs.some((j) => j.status === 'failed')) {
      throw new Error(`Sync job failed: ${JSON.stringify(jobs)}`);
    }
    await sleep(2_000);
  }
  throw new Error('Sync did not reach completed status in time');
}

async function fetchTransactionCount(token: string): Promise<number> {
  const res = await apiFetch<{ items: unknown[] }>('/api/transactions', { token });
  return res.body.items.length;
}

function queryCipher(integrationId: string): Promise<string> {
  const sql = `SELECT cipher FROM credentials WHERE integration_id = '${integrationId}'`;
  return new Promise((resolve, reject) => {
    execFile(
      'docker',
      ['exec', 'byrdos-postgres-1', 'psql', '-U', 'postgres', '-d', DB_NAME, '-t', '-c', sql],
      { encoding: 'utf8' },
      (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.trim());
      },
    );
  });
}

function queryDuplicateCount(connectionId: string): Promise<{ total: number; distinct: number }> {
  const sql = `
    SELECT
      COUNT(*)::int AS total,
      COUNT(DISTINCT (t.account_id, t.external_id))::int AS distinct
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE a.connection_id = '${connectionId}'
  `;
  return new Promise((resolve, reject) => {
    execFile(
      'docker',
      ['exec', 'byrdos-postgres-1', 'psql', '-U', 'postgres', '-d', DB_NAME, '-t', '-c', sql],
      { encoding: 'utf8' },
      (err, stdout) => {
        if (err) return reject(err);
        const parts = stdout
          .trim()
          .split(/\s*\|\s*/)
          .map(Number);
        resolve({ total: parts[0] ?? 0, distinct: parts[1] ?? 0 });
      },
    );
  });
}

async function waitForTransactions(token: string, timeoutMs: number): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const count = await fetchTransactionCount(token);
    if (count > 0) return count;
    await sleep(2_000);
  }
  return 0;
}

describe('connect → sync → display (live Plaid sandbox e2e)', () => {
  test('full flow against Plaid sandbox', async ({ skip }) => {
    if (!ENABLED) {
      skip('PLAID_LIVE_SANDBOX_E2E is not set to true');
    }
    if (!hasCreds()) {
      skip('PLAID_CLIENT_ID / PLAID_SECRET missing');
    }
    if (!containerRunning('byrdos-postgres-1') || !containerRunning('byrdos-redis-1')) {
      skip('byrdos-postgres-1 / byrdos-redis-1 not running');
    }

    const logBase = path.join(os.tmpdir(), 'byrdos-e2e');
    const apiLog = createWriteStream(`${logBase}-api.log`, { flags: 'a' });
    const workerLog = createWriteStream(`${logBase}-worker.log`, { flags: 'a' });

    let apiProcess: ReturnType<typeof spawn> | undefined;
    let workerProcess: ReturnType<typeof spawn> | undefined;

    try {
      apiProcess = spawn('node', ['dist/main.js'], {
        cwd: path.resolve('.'),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      apiProcess.stdout?.pipe(apiLog, { end: false });
      apiProcess.stderr?.pipe(apiLog, { end: false });

      workerProcess = spawn('node', ['dist/index.js'], {
        cwd: path.resolve('../../services/sync-worker'),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      workerProcess.stdout?.pipe(workerLog, { end: false });
      workerProcess.stderr?.pipe(workerLog, { end: false });

      await waitForReady(API_READY_URL);

      const email = `e2e-${Date.now()}@byrdos.dev`;
      const password = 'Password123!';
      const signup = await apiFetch<{ user: { id: string }; accessToken: string }>(
        '/api/auth/signup',
        { method: 'POST', body: JSON.stringify({ email, password, name: 'E2E' }) },
      );
      expect(signup.status).toBe(201);
      const token = signup.body.accessToken;

      const initiate = await apiFetch<{ linkToken: string; integrationId: string }>(
        '/api/links/initiate',
        { method: 'POST', token, body: JSON.stringify({ providerId: 'plaid' }) },
      );
      expect(initiate.status).toBe(201);
      const integrationId = initiate.body.integrationId;

      const plaidRes = await fetch('https://sandbox.plaid.com/sandbox/public_token/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: PLAID_CLIENT_ID,
          secret: PLAID_SECRET,
          institution_id: 'ins_3',
          initial_products: ['transactions', 'auth'],
        }),
      });
      expect(plaidRes.status).toBe(200);
      const plaidBody = (await plaidRes.json()) as { public_token: string };
      const publicToken = plaidBody.public_token;

      const exchange = await apiFetch<{ id: string }>('/api/links/exchange', {
        method: 'POST',
        token,
        body: JSON.stringify({
          integrationId,
          publicToken,
          metadata: { institution: { name: 'Chase', institution_id: 'ins_3' } },
        }),
      });
      expect(exchange.status).toBe(201);
      expect(exchange.body.id).toBeDefined();
      const connectionId = exchange.body.id;

      const cipher = await queryCipher(integrationId);
      expect(cipher).not.toBe('placeholder-token');
      expect(cipher).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
      expect(Buffer.from(cipher, 'base64').toString('base64')).toBe(cipher);

      const trigger = await apiFetch<{ success: boolean }>(`/api/sync/${connectionId}`, {
        method: 'POST',
        token,
      });
      expect(trigger.status).toBe(201);
      expect(trigger.body.success).toBe(true);

      await pollSyncCompleted(connectionId, token);

      const accountsRes = await apiFetch<{ items: unknown[] }>('/api/accounts', { token });
      expect(accountsRes.status).toBe(200);
      expect(accountsRes.body.items.length).toBeGreaterThan(0);
      const accountCount = accountsRes.body.items.length;

      let txCount = await waitForTransactions(token, 90_000);
      if (txCount === 0) {
        await sleep(5_000);
        const trigger2 = await apiFetch<{ success: boolean }>(`/api/sync/${connectionId}`, {
          method: 'POST',
          token,
        });
        expect(trigger2.status).toBe(201);
        expect(trigger2.body.success).toBe(true);
        await pollSyncCompleted(connectionId, token);
        txCount = await waitForTransactions(token, 90_000);
      }
      expect(txCount).toBeGreaterThan(0);

      const trigger3 = await apiFetch<{ success: boolean }>(`/api/sync/${connectionId}`, {
        method: 'POST',
        token,
      });
      expect(trigger3.status).toBe(201);
      expect(trigger3.body.success).toBe(true);
      await pollSyncCompleted(connectionId, token);

      const txCountAfterResync = await fetchTransactionCount(token);
      expect(txCountAfterResync).toBe(txCount);

      const duplicates = await queryDuplicateCount(connectionId);
      expect(duplicates.total).toBeGreaterThan(0);
      expect(duplicates.total).toBe(duplicates.distinct);

      console.log(
        `✅ live e2e passed: accounts=${accountCount}, transactions=${txCount}, idempotent=${txCountAfterResync}`,
      );
    } finally {
      if (workerProcess) await killProcess(workerProcess);
      if (apiProcess) await killProcess(apiProcess);
      apiLog.end();
      workerLog.end();
    }
  }, 420_000);
});
