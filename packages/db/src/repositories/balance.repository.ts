import { eq, and, desc, lt, or } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type {
  Balance,
  BalanceRepository,
  CreateBalanceInput,
  PaginatedResult,
  PaginationOptions,
} from '@byrdos/domain';
import type { DbClient } from '../client.js';
import { balances } from '../schema/balance.schema.js';

const DEFAULT_LIMIT = 50;

interface BalanceCursor {
  recordedAt: string;
  id: string;
}

function encodeCursor(cursor: BalanceCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): BalanceCursor {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as BalanceCursor;
}

export class DrizzleBalanceRepository implements BalanceRepository {
  constructor(private readonly db: DbClient) {}

  async findLatestByAccountId(accountId: string): Promise<Balance | null> {
    const rows = await this.db
      .select()
      .from(balances)
      .where(eq(balances.accountId, accountId))
      .orderBy(desc(balances.recordedAt), desc(balances.id))
      .limit(1);
    return rows[0] ? mapBalanceRow(rows[0]) : null;
  }

  async findByAccountId(accountId: string, options?: PaginationOptions): Promise<PaginatedResult<Balance>> {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const decodedCursor = options?.cursor ? decodeCursor(options.cursor) : null;

    const rows = await this.db
      .select()
      .from(balances)
      .where(
        and(
          eq(balances.accountId, accountId),
          decodedCursor
            ? or(
                lt(balances.recordedAt, new Date(decodedCursor.recordedAt)),
                and(
                  eq(balances.recordedAt, new Date(decodedCursor.recordedAt)),
                  lt(balances.id, decodedCursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(balances.recordedAt), desc(balances.id))
      .limit(limit + 1);

    return toPaginatedResult(rows.map(mapBalanceRow), limit);
  }

  async create(input: CreateBalanceInput): Promise<Balance> {
    const id = uuidv7();
    const [row] = await this.db
      .insert(balances)
      .values({
        id,
        accountId: input.accountId,
        current: input.current,
        available: input.available,
        limit: input.limit,
        currency: input.currency,
        recordedAt: input.recordedAt,
      })
      .returning();
    return mapBalanceRow(row);
  }
}

function mapBalanceRow(row: typeof balances.$inferSelect): Balance {
  return {
    id: row.id,
    accountId: row.accountId,
    current: row.current,
    available: row.available,
    limit: row.limit,
    currency: row.currency,
    recordedAt: row.recordedAt,
    createdAt: row.createdAt,
  };
}

function toPaginatedResult(items: Balance[], limit: number): PaginatedResult<Balance> {
  const hasMore = items.length > limit;
  const result = items.slice(0, limit);
  return {
    items: result,
    nextCursor: hasMore
      ? encodeCursor({
          recordedAt: result[result.length - 1].recordedAt.toISOString(),
          id: result[result.length - 1].id,
        })
      : null,
    hasMore,
  };
}
