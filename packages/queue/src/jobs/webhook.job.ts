import type { QueueName } from '../queue-names';

export interface WebhookJobData {
  providerId: string;
  webhookType: string;
  webhookCode: string;
  payload: Record<string, unknown>;
  signature: string;
  receivedAt: string;
}

export const WEBHOOK_JOB: QueueName = 'webhooks';
