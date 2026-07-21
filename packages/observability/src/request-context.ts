import { Injectable, type NestMiddleware } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import { createLogger } from './logger.js';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  [key: string]: unknown;
}

interface ResponseLike {
  setHeader(name: string, value: string): void;
  [key: string]: unknown;
}

interface RequestContext {
  requestId: string;
  correlationId: string;
  logger: Logger;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();
const rootRequestLogger = createLogger('request');

export function getRequestContext():
  Pick<RequestContext, 'requestId' | 'correlationId'> | undefined {
  const store = asyncLocalStorage.getStore();
  if (!store) return undefined;
  return {
    requestId: store.requestId,
    correlationId: store.correlationId,
  };
}

export function createRequestIdMiddleware() {
  @Injectable()
  class RequestIdMiddleware implements NestMiddleware {
    use(req: RequestLike, res: ResponseLike, next: () => void): void {
      const requestId = (req.headers['x-request-id'] as string | undefined) || randomUUID();
      const correlationId = randomUUID();

      req.requestId = requestId;
      req.correlationId = correlationId;

      res.setHeader('X-Request-Id', requestId);
      res.setHeader('X-Correlation-Id', correlationId);

      const logger = rootRequestLogger.child({ requestId, correlationId });

      asyncLocalStorage.run({ requestId, correlationId, logger }, next);
    }
  }

  return RequestIdMiddleware;
}
