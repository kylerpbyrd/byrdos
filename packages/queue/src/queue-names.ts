// DEFERRED per RFC-0001 Decision 3: CLASSIFY, NOTIFICATIONS, OUTBOX, and SYNC_DEAD
// have no consumer yet. Wire only after a consumer + event shape + retry policy are defined.
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
