import { Queue } from 'bullmq';

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface QueueMetricsCollector {
  start(intervalMs?: number): void;
  stop(): void;
  getMetrics(): Record<string, QueueMetrics>;
}

const metrics: Record<string, QueueMetrics> = {};

export function createQueueMetricsCollector(queues: Queue[]): QueueMetricsCollector {
  let timer: ReturnType<typeof setInterval> | undefined;

  async function poll(): Promise<void> {
    for (const queue of queues) {
      try {
        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        );
        metrics[queue.name] = {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
        };
      } catch {
        metrics[queue.name] = metrics[queue.name] ?? {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        };
      }
    }
  }

  return {
    start(intervalMs = 30_000) {
      if (timer) return;
      void poll();
      timer = setInterval(() => void poll(), intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    },
    getMetrics() {
      return { ...metrics };
    },
  };
}
