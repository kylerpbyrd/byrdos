import {
  context,
  type Span as OtelSpan,
  type Tracer as OtelApiTracer,
  SpanStatusCode,
  type Context,
} from '@opentelemetry/api';
import {
  type AttributeValue,
  type Span,
  type StartSpanOptions,
  type Tracer,
} from './tracer.js';

class OtelSpanWrapper implements Span {
  constructor(private readonly span: OtelSpan) {}

  getApiSpan(): OtelSpan {
    return this.span;
  }

  setAttribute(key: string, value: AttributeValue): void {
    this.span.setAttribute(key, value);
  }

  setStatus(code: 'OK' | 'ERROR', message?: string): void {
    this.span.setStatus({
      code: code === 'OK' ? SpanStatusCode.OK : SpanStatusCode.ERROR,
      message,
    });
  }

  recordException(error: Error): void {
    this.span.recordException(error);
  }

  end(endTime?: number): void {
    this.span.end(endTime);
  }
}

export function getOtelApiSpan(span: Span): OtelSpan | undefined {
  return span instanceof OtelSpanWrapper ? span.getApiSpan() : undefined;
}

export class OtelTracer implements Tracer {
  constructor(private readonly otelTracer: OtelApiTracer) {}

  startSpan(name: string, options?: StartSpanOptions): Span {
    const attributes = options?.attributes;
    const startTime = options?.startTime;
    const parentContext = options?.parentContext as Context | undefined;

    const otelSpan = this.otelTracer.startSpan(
      name,
      { attributes, startTime },
      parentContext ?? context.active(),
    );

    return new OtelSpanWrapper(otelSpan);
  }
}
