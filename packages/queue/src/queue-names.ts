export const QUEUES = {
  SYNC: 'sync',
  ACCOUNTS: 'accounts',
  TRANSACTIONS: 'transactions',
  CLASSIFY: 'classify',
  WEBHOOKS: 'webhooks',
  OUTBOX: 'outbox',
  NOTIFICATIONS: 'notifications',
  SYNC_DEAD: 'sync.dead',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
