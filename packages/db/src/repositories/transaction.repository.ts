import { eq, and, gte, lte, desc, lt, or } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type {
  PaginatedResult,
  Transaction,
  TransactionPaginationOptions,
  TransactionRepository,
  UpsertTransactionInput,
} from '@byrdos/domain';
import type { DbClient } from '../client.js';
import { accounts } from '../schema/account.schema.js';
import { integrations } from '../schema/integration.schema.js';
import { providerConnections } from '../schema/provider-connection.schema.js';
import { transactions } from '../schema/transaction.schema.js';

const DEFAULT_LIMIT = 50;

interface TransactionCursor {
  date: string;
  id: string;
}

function encodeCursor(cursor: TransactionCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): TransactionCursor {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as TransactionCursor;
}

export class DrizzleTransactionRepository implements TransactionRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Transaction | null> {
    const rows = await this.db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    return rows[0] ? mapTransactionRow(rows[0]) : null;
  }

  async findByAccountId(
    accountId: string,
    options?: TransactionPaginationOptions,
  ): Promise<PaginatedResult<Transaction>> {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const decodedCursor = options?.cursor ? decodeCursor(options.cursor) : null;

    const rows = await this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          decodedCursor
            ? or(
                lt(transactions.date, decodedCursor.date),
                and(
                  eq(transactions.date, decodedCursor.date),
                  lt(transactions.id, decodedCursor.id),
                ),
              )
            : undefined,
          options?.startDate ? gte(transactions.date, options.startDate) : undefined,
          options?.endDate ? lte(transactions.date, options.endDate) : undefined,
          options?.pending !== undefined ? eq(transactions.pending, options.pending) : undefined,
        ),
      )
      .orderBy(desc(transactions.date), desc(transactions.id))
      .limit(limit + 1);

    return toPaginatedResult(rows.map(mapTransactionRow), limit);
  }

  async findByAccountIdAndUserId(
    accountId: string,
    userId: string,
    options?: TransactionPaginationOptions,
  ): Promise<PaginatedResult<Transaction>> {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const decodedCursor = options?.cursor ? decodeCursor(options.cursor) : null;

    const rows = await this.db
      .select()
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .innerJoin(providerConnections, eq(accounts.connectionId, providerConnections.id))
      .innerJoin(integrations, eq(providerConnections.integrationId, integrations.id))
      .where(
        and(
          eq(transactions.accountId, accountId),
          eq(integrations.userId, userId),
          decodedCursor
            ? or(
                lt(transactions.date, decodedCursor.date),
                and(
                  eq(transactions.date, decodedCursor.date),
                  lt(transactions.id, decodedCursor.id),
                ),
              )
            : undefined,
          options?.startDate ? gte(transactions.date, options.startDate) : undefined,
          options?.endDate ? lte(transactions.date, options.endDate) : undefined,
          options?.pending !== undefined ? eq(transactions.pending, options.pending) : undefined,
        ),
      )
      .orderBy(desc(transactions.date), desc(transactions.id))
      .limit(limit + 1);

    return toPaginatedResult(
      rows.map((row) => mapTransactionRow(row.transactions)),
      limit,
    );
  }

  async findByUserId(
    userId: string,
    options?: TransactionPaginationOptions,
  ): Promise<PaginatedResult<Transaction>> {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const decodedCursor = options?.cursor ? decodeCursor(options.cursor) : null;

    const rows = await this.db
      .select()
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .innerJoin(providerConnections, eq(accounts.connectionId, providerConnections.id))
      .innerJoin(integrations, eq(providerConnections.integrationId, integrations.id))
      .where(
        and(
          eq(integrations.userId, userId),
          decodedCursor
            ? or(
                lt(transactions.date, decodedCursor.date),
                and(
                  eq(transactions.date, decodedCursor.date),
                  lt(transactions.id, decodedCursor.id),
                ),
              )
            : undefined,
          options?.startDate ? gte(transactions.date, options.startDate) : undefined,
          options?.endDate ? lte(transactions.date, options.endDate) : undefined,
          options?.pending !== undefined ? eq(transactions.pending, options.pending) : undefined,
        ),
      )
      .orderBy(desc(transactions.date), desc(transactions.id))
      .limit(limit + 1);

    return toPaginatedResult(
      rows.map((row) => mapTransactionRow(row.transactions)),
      limit,
    );
  }

  async upsert(input: UpsertTransactionInput): Promise<Transaction> {
    const id = uuidv7();
    const [row] = await this.db
      .insert(transactions)
      .values({
        id,
        accountId: input.accountId,
        externalId: input.externalId,
        amountCents: input.amountCents,
        date: input.date,
        authorizedDate: input.authorizedDate,
        name: input.name,
        merchantName: input.merchantName,
        pending: input.pending,
        pendingTransactionExternalId: input.pendingTransactionExternalId,
        paymentChannel: input.paymentChannel,
        isoCurrencyCode: input.isoCurrencyCode,
        categoryHash: input.categoryHash,
        raw: input.raw,
      })
      .onConflictDoUpdate({
        target: [transactions.accountId, transactions.externalId],
        set: {
          amountCents: input.amountCents,
          date: input.date,
          authorizedDate: input.authorizedDate,
          name: input.name,
          merchantName: input.merchantName,
          pending: input.pending,
          pendingTransactionExternalId: input.pendingTransactionExternalId,
          paymentChannel: input.paymentChannel,
          isoCurrencyCode: input.isoCurrencyCode,
          categoryHash: input.categoryHash,
          raw: input.raw,
        },
      })
      .returning();
    return mapTransactionRow(row);
  }

  async updateCategory(transactionId: string, categoryHash: string): Promise<Transaction> {
    const [row] = await this.db
      .update(transactions)
      .set({ categoryHash })
      .where(eq(transactions.id, transactionId))
      .returning();
    return mapTransactionRow(row);
  }
}

function mapTransactionRow(row: typeof transactions.$inferSelect): Transaction {
  return {
    id: row.id,
    accountId: row.accountId,
    externalId: row.externalId,
    amountCents: row.amountCents,
    date: row.date,
    authorizedDate: row.authorizedDate,
    name: row.name,
    merchantName: row.merchantName,
    pending: row.pending,
    pendingTransactionExternalId: row.pendingTransactionExternalId,
    paymentChannel: row.paymentChannel,
    isoCurrencyCode: row.isoCurrencyCode,
    categoryHash: row.categoryHash,
    raw: row.raw as Record<string, unknown> | null,
    createdAt: row.createdAt,
  };
}

function toPaginatedResult(items: Transaction[], limit: number): PaginatedResult<Transaction> {
  const hasMore = items.length > limit;
  const result = items.slice(0, limit);
  return {
    items: result,
    nextCursor: hasMore
      ? encodeCursor({
          date: result[result.length - 1].date,
          id: result[result.length - 1].id,
        })
      : null,
    hasMore,
  };
}
