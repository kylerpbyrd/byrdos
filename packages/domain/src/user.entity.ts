export type UserStatus = 'active' | 'disabled';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly image: string | null;
  readonly status: UserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
