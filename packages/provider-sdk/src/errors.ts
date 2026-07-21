export class ProviderError extends Error {
  public readonly code: string;
  public readonly providerId: string;
  public readonly retryable: boolean;
  public readonly meta: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    options: { providerId: string; errorCode?: string; retryable?: boolean; meta?: Record<string, unknown> } = { providerId: 'unknown' }
  ) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.providerId = options.providerId;
    this.retryable = options.retryable ?? false;
    this.meta = options.meta ?? {};
  }
}
