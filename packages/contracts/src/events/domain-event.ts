import type { AccountsSyncedEvent } from './account-events.js';
import type { TransactionsSyncedEvent } from './transaction-events.js';

export type DomainEvent = AccountsSyncedEvent | TransactionsSyncedEvent;
