import type { User, UserStatus } from './user.entity';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name?: string | null;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  updateStatus(id: string, status: UserStatus): Promise<User>;

  /** Returns the stored password hash for a user, or null if none (e.g. Google OAuth user). Used ONLY by auth layer. */
  getPasswordHash(email: string): Promise<string | null>;
}
