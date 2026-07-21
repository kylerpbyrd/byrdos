import type { JobsOptions } from 'bullmq';

export const DEFAULT_RETRY: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 1000 },
};

export const PROVIDER_RETRY: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 1000 },
};
