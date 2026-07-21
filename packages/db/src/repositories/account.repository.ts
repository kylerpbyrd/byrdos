import { eq, and, gt } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type {
  Account,
  AccountRepository,
  AccountStatus,
  AccountType,
  CreateAccountInput,
  PaginatedResult,
  PaginationOptions,
} from '@byrdos/domain';
import type { DbClient } from '../client.js';
import { accounts } from '../schema/account.schema.js';
import { integrations } from '../schema/integration.schema.js';
import { providerConnections } from '../schema/provider-connection.schema.js';

const DEFAULT_LIMIT = 50;

function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id }), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): string {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')).id as string;
}

export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Account | null> {
    const rows = await this.db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    return rows[0] ? mapAccountRow(rows[0]) : null;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Account | null> {
    const rows = await this.db
      .select()
      .from(accounts)
      .innerJoin(providerConnections, eq(accounts.connectionId, providerConnections.id))
      .innerJoin(integrations, eq(providerConnections.integrationId, integrations.id))
      .where(and(eq(accounts.id, id), eq(integrations.userId, userId)))
      .limit(1);
    return rows[0] ? mapAccountRow(rows[0].accounts) : null;
  }

  async findByConnectionId(connectionId: string): Promise<Account[]> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.connectionId, connectionId));
    return rows.map(mapAccountRow);
  }

  async findByUserId(
    userId: string,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<Account>> {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const decodedCursor = options?.cursor ? decodeCursor(options.cursor) : null;

    const rows = await this.db
      .select()
      .from(accounts)
      .innerJoin(providerConnections, eq(accounts.connectionId, providerConnections.id))
      .innerJoin(integrations, eq(providerConnections.integrationId, integrations.id))
      .where(
        and(
          eq(integrations.userId, userId),
          decodedCursor ? gt(accounts.id, decodedCursor) : undefined,
        ),
      )
      .orderBy(accounts.id)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => mapAccountRow(row.accounts));
    const nextCursor = hasMore ? encodeCursor(items[items.length - 1].id) : null;

    return { items, nextCursor, hasMore };
  }

  async create(input: CreateAccountInput): Promise<Account> {
    const id = uuidv7();
    const [row] = await this.db
      .insert(accounts)
      .values({
        id,
        connectionId: input.connectionId,
        externalId: input.externalId,
        mask: input.mask,
        name: input.name,
        officialName: input.officialName,
        type: input.type,
        subtype: input.subtype,
        currentBalanceCents: input.currentBalanceCents,
        availableBalanceCents: input.availableBalanceCents,
        balanceLimitCents: input.balanceLimitCents,
        currency: input.currency,
        status: input.status,
      })
      .returning();
    return mapAccountRow(row);
  }

  async updateBalance(
    id: string,
    currentBalanceCents: number,
    availableBalanceCents: number | null,
    balanceLimitCents: number | null,
  ): Promise<Account> {
    const [row] = await this.db
      .update(accounts)
      .set({
        currentBalanceCents,
        availableBalanceCents,
        balanceLimitCents,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, id))
      .returning();
    return mapAccountRow(row);
  }

  async updateStatus(id: string, status: AccountStatus): Promise<Account> {
    const [row] = await this.db
      .update(accounts)
      .set({ status, updatedAt: new Date() })
      .where(eq(accounts.id, id))
      .returning();
    return mapAccountRow(row);
  }
}

function mapAccountRow(row: typeof accounts.$inferSelect): Account {
  return {
    id: row.id,
    connectionId: row.connectionId,
    externalId: row.externalId,
    mask: row.mask,
    name: row.name,
    officialName: row.officialName,
    type: row.type as AccountType,
    subtype: row.subtype,
    currentBalanceCents: row.currentBalanceCents,
    availableBalanceCents: row.availableBalanceCents,
    balanceLimitCents: row.balanceLimitCents,
    currency: row.currency,
    status: row.status as AccountStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
