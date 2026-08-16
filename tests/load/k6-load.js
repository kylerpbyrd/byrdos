import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE = __ENV.API_BASE || 'http://localhost:4000';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'm5-live2@byrdos.test';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'Passw0rd!123';

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:"ready"}': ['p(95)<500'],
    'http_req_duration{name:"metrics"}': ['p(95)<500'],
    'http_req_duration{name:"accounts"}': ['p(95)<500'],
    'http_req_duration{name:"transactions"}': ['p(95)<500'],
  },
};

export function setup() {
  const signinUrl = `${API_BASE}/api/auth/signin`;
  const signinRes = http.post(
    signinUrl,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const signinOk = check(signinRes, {
    'signin status is 200': r => r.status === 200,
    'signin returns accessToken': r => {
      try {
        return typeof r.json('accessToken') === 'string' && r.json('accessToken').length > 0;
      } catch (e) {
        return false;
      }
    },
  });

  if (!signinOk) {
    throw new Error(`Setup failed: signin returned ${signinRes.status}: ${signinRes.body}`);
  }

  const accessToken = signinRes.json('accessToken');
  console.log(`Authenticated as ${TEST_EMAIL}; token acquired.`);
  return { accessToken };
}

export default function (data) {
  const authHeaders = {
    headers: {
      Authorization: `Bearer ${data.accessToken}`,
    },
  };

  const readyRes = http.get(`${API_BASE}/health/ready`, { name: 'ready' });
  check(readyRes, {
    'ready status is 200': r => r.status === 200,
  });

  const metricsRes = http.get(`${API_BASE}/metrics`, { name: 'metrics' });
  check(metricsRes, {
    'metrics status is 200': r => r.status === 200,
  });

  const accountsRes = http.get(`${API_BASE}/api/accounts`, {
    ...authHeaders,
    name: 'accounts',
  });
  check(accountsRes, {
    'accounts status is 200': r => r.status === 200,
  });

  const transactionsRes = http.get(`${API_BASE}/api/transactions`, {
    ...authHeaders,
    name: 'transactions',
  });
  check(transactionsRes, {
    'transactions status is 200': r => r.status === 200,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(
      {
        title: 'byrdOS API Load Test Summary',
        baseUrl: API_BASE,
        thresholds: data.metrics.thresholds || {},
        checksPassed: data.metrics.checks ? data.metrics.checks.passes : null,
        checksFailed: data.metrics.checks ? data.metrics.checks.fails : null,
        httpReqFailedRate: data.metrics.http_req_failed ? data.metrics.http_req_failed.rate : null,
        accountsP95: data.metrics.http_req_duration
          ? data.metrics.http_req_duration.values['p(95)']
          : null,
        iterations: data.metrics.iterations ? data.metrics.iterations.count : null,
      },
      null,
      2,
    ),
  };
}
