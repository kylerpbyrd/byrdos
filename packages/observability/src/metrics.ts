import { Registry, collectDefaultMetrics, Counter, Gauge } from 'prom-client';

const register = new Registry();

let defaultMetricsRegistered = false;
if (!defaultMetricsRegistered) {
  collectDefaultMetrics({ register });
  defaultMetricsRegistered = true;
}

export const syncCursorFreshnessRatioGauge = new Gauge({
  name: 'byrdos_sync_cursor_freshness_ratio',
  help: 'Ratio of active provider connections whose sync cursor was updated within 24h',
  registers: [register],
});

export const syncJobsTotalCounter = new Counter({
  name: 'byrdos_sync_jobs_total',
  help: 'Total number of sync jobs processed',
  labelNames: ['status'],
  registers: [register],
});

export const queueDepthGauge = new Gauge({
  name: 'byrdos_queue_depth',
  help: 'Current depth of job queues',
  labelNames: ['queue', 'state'],
  registers: [register],
});

export const syncSuccessRatioGauge = new Gauge({
  name: 'byrdos_sync_success_ratio',
  help: 'Ratio of sync jobs that completed successfully (completed / (completed + failed))',
  registers: [register],
});

export function getMetricsText(): Promise<string> {
  return register.metrics();
}
