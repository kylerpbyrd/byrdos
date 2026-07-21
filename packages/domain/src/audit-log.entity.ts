export interface AuditLog {
  readonly id: string;
  readonly actor: string;
  readonly action: string;
  readonly target: string;
  readonly meta: Record<string, unknown> | null;
  readonly createdAt: Date;
}
