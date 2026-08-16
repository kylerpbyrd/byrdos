export { createLogger } from './logger.js';
export type { Logger } from 'pino';

export { createRequestIdMiddleware, getRequestContext } from './request-context.js';

export { withTiming } from './timing.js';

export {
  createQueueMetricsCollector,
  type QueueMetrics,
  type QueueMetricsCollector,
} from './queue-metrics.js';

export {
  type AttributeValue,
  type Span,
  type StartSpanOptions,
  type Tracer,
  type InitTracingOptions,
  NoopSpan,
  NoopTracer,
  getTracer,
  setTracer,
  initTracing,
  shutdownTracing,
  injectTraceContext,
  extractTraceContext,
} from './tracer.js';

export {
  getMetricsText,
  syncCursorFreshnessRatioGauge,
  syncJobsTotalCounter,
  queueDepthGauge,
  syncSuccessRatioGauge,
} from './metrics.js';

export { sendAlert } from './alert.js';
