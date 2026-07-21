import { createLogger } from './logger.js';

const timingLogger = createLogger('timing');

export async function withTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const durationMs = Number((performance.now() - start).toFixed(3));
    timingLogger.debug({ label, durationMs }, 'timed operation');
  }
}
