import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { UserRepository, CreateUserInput, User, UserStatus } from '@byrdos/domain';
import type { DbClient } from '../client.js';
import { users } from '../schema/user.schema.js';

function mapRow(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    status: row.status as UserStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const id = uuidv7();
    const [row] = await this.db
      .insert(users)
      .values({
        id,
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        name: input.name ?? null,
        status: 'active',
      })
      .returning();
    return mapRow(row);
  }

  async updateStatus(id: string, status: UserStatus): Promise<User> {
    const [row] = await this.db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return mapRow(row);
  }

  async getPasswordHash(email: string): Promise<string | null> {
    const rows = await this.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return rows[0]?.passwordHash ?? null;
  }
}
