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

function queryCipher(integrationId: string): Promise<string> {
  // Integration IDs are generated internally as UUIDs, so direct interpolation is safe here.
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

function ensureBuilt(): void {
  const apiDist = path.resolve('dist/main.js');
  const workerDist = path.resolve('../../services/sync-worker/dist/index.js');
  if (!existsSync(apiDist)) {
    throw new Error(
      `Built API not found at ${apiDist}. Run 'pnpm --filter @byrdos/api run build' first.`,
    );
  }
  if (!existsSync(workerDist)) {
    throw new Error(
      `Built sync-worker not found at ${workerDist}. Run 'pnpm --filter @byrdos/sync-worker run build' first.`,
    );
  }
}

describe('connect → sync → display (offline fake-provider fixture e2e)', () => {
  test('full flow with FakeProviderAdapter', async ({ skip }) => {
    if (!containerRunning('byrdos-postgres-1') || !containerRunning('byrdos-redis-1')) {
      skip('byrdos-postgres-1 / byrdos-redis-1 not running');
    }

    ensureBuilt();

    const logBase = path.join(os.tmpdir(), 'byrdos-e2e-fixture');
    const apiLog = createWriteStream(`${logBase}-api.log`, { flags: 'a' });
    const workerLog = createWriteStream(`${logBase}-worker.log`, { flags: 'a' });

    let apiProcess: ReturnType<typeof spawn> | undefined;
    let workerProcess: ReturnType<typeof spawn> | undefined;

    const childEnv = { ...process.env, PROVIDER: 'fake' };

    try {
      apiProcess = spawn('node', ['dist/main.js'], {
        cwd: path.resolve('.'),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: childEnv,
      });
      apiProcess.stdout?.pipe(apiLog, { end: false });
      apiProcess.stderr?.pipe(apiLog, { end: false });

      workerProcess = spawn('node', ['dist/index.js'], {
        cwd: path.resolve('../../services/sync-worker'),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: childEnv,
      });
      workerProcess.stdout?.pipe(workerLog, { end: false });
      workerProcess.stderr?.pipe(workerLog, { end: false });

      await waitForReady(API_READY_URL);

      const email = `fixture-${Date.now()}@byrdos.dev`;
      const password = 'Password123!';
      const signup = await apiFetch<{ user: { id: string }; accessToken: string }>(
        '/api/auth/signup',
        { method: 'POST', body: JSON.stringify({ email, password, name: 'Fixture' }) },
      );
      expect(signup.status).toBe(201);
      const token = signup.body.accessToken;

      const initiate = await apiFetch<{ linkToken: string; integrationId: string }>(
        '/api/links/initiate',
        { method: 'POST', token, body: JSON.stringify({ providerId: 'plaid' }) },
      );
      expect(initiate.status).toBe(201);
      const integrationId = initiate.body.integrationId;
      expect(integrationId).toBeDefined();

      const exchange = await apiFetch<{ id: string }>('/api/links/exchange', {
        method: 'POST',
        token,
        body: JSON.stringify({
          integrationId,
          publicToken: 'fake',
          metadata: { institution: { name: 'Fake Bank', institution_id: 'fake-ins' } },
        }),
      });
      expect(exchange.status).toBe(201);
      expect(exchange.body.id).toBeDefined();
      const connectionId = exchange.body.id;

      const trigger = await apiFetch<{ success: boolean }>(`/api/sync/${connectionId}`, {
        method: 'POST',
        token,
      });
      expect(trigger.status).toBe(201);
      expect(trigger.body.success).toBe(true);

      await pollSyncCompleted(connectionId, token);

      const accountsRes = await apiFetch<{ items: unknown[] }>('/api/accounts', { token });
      expect(accountsRes.status).toBe(200);
      expect(accountsRes.body.items.length).toBe(2);

      const transactionsRes = await apiFetch<{ items: unknown[] }>('/api/transactions', { token });
      expect(transactionsRes.status).toBe(200);
      expect(transactionsRes.body.items.length).toBe(2);

      const cipher = await queryCipher(integrationId);
      expect(cipher).not.toBe('');
      expect(cipher).not.toBe('placeholder-token');

      console.log(
        `✅ fixture e2e passed: accounts=${accountsRes.body.items.length}, transactions=${transactionsRes.body.items.length}`,
      );
    } finally {
      if (workerProcess) await killProcess(workerProcess);
      if (apiProcess) await killProcess(apiProcess);
      apiLog.end();
      workerLog.end();
    }
  }, 420_000);
});
