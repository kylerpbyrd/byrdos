import { context, propagation, ROOT_CONTEXT, trace } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getOtelApiSpan, OtelTracer } from './otel-tracer.js';

export type AttributeValue = string | number | boolean;

export interface Span {
  setAttribute(key: string, value: AttributeValue): void;
  setStatus(code: 'OK' | 'ERROR', message?: string): void;
  recordException(error: Error): void;
  end(endTime?: number): void;
}

export interface StartSpanOptions {
  attributes?: Record<string, AttributeValue>;
  parentContext?: unknown;
  startTime?: number;
}

export interface Tracer {
  startSpan(name: string, options?: StartSpanOptions): Span;
}

export class NoopSpan implements Span {
  setAttribute(): void {
    // no-op
  }

  setStatus(): void {
    // no-op
  }

  recordException(): void {
    // no-op
  }

  end(): void {
    // no-op
  }
}

export class NoopTracer implements Tracer {
  startSpan(): Span {
    return new NoopSpan();
  }
}

let tracer: Tracer = new NoopTracer();
let provider: NodeTracerProvider | null = null;
let initialized = false;

export function setTracer(next: Tracer): void {
  tracer = next;
}

export function getTracer(): Tracer {
  return tracer;
}

export interface InitTracingOptions {
  instrumentHttp?: boolean;
}

/**
 * Initialize OpenTelemetry tracing for a service.
 *
 * @param serviceName - The service name attached to every span as a resource attribute.
 * @param options - Optional configuration. When `instrumentHttp: true`, HTTP and Express
 *   auto-instrumentation is enabled. Callers MUST call `initTracing` before the HTTP
 *   framework (Express/Nest) is instantiated, otherwise route patching won't take effect.
 */
export function initTracing(
  serviceName: string,
  options?: InitTracingOptions,
): void {
  if (initialized) {
    return;
  }
  initialized = true;

  const resource = defaultResource().merge(
    resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
  );

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const exporter = endpoint
    ? new OTLPTraceExporter({ url: endpoint })
    : new ConsoleSpanExporter();

  provider = new NodeTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });
  provider.register();

  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  if (options?.instrumentHttp === true) {
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation(),
        new ExpressInstrumentation(),
      ],
    });
  }

  setTracer(new OtelTracer(trace.getTracer('byrdos')));
}

export async function shutdownTracing(): Promise<void> {
  if (provider === null) {
    return;
  }

  if (typeof provider.forceFlush === 'function') {
    await provider.forceFlush();
  }

  await provider.shutdown();
}

export function injectTraceContext(
  span?: Span,
): Record<string, string> | undefined {
  const carrier: Record<string, string> = {};
  const otelSpan = span ? getOtelApiSpan(span) : undefined;
  const ctx = otelSpan
    ? trace.setSpan(ROOT_CONTEXT, otelSpan)
    : context.active();
  propagation.inject(ctx, carrier);
  return Object.keys(carrier).length > 0 ? carrier : undefined;
}

export function extractTraceContext(
  carrier?: Record<string, string>,
): unknown | undefined {
  return carrier ? propagation.extract(ROOT_CONTEXT, carrier) : undefined;
}
