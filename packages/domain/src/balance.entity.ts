export interface Balance {
  readonly id: string;
  readonly accountId: string;
  readonly current: number;
  readonly available: number | null;
  readonly limit: number | null;
  readonly currency: string;
  readonly recordedAt: Date;
  readonly createdAt: Date;
}
