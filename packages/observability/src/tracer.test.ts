import { describe, it, expect, afterAll } from 'vitest';
import {
  getTracer,
  initTracing,
  shutdownTracing,
  injectTraceContext,
  extractTraceContext,
} from './tracer.js';

describe('tracer', () => {
  afterAll(async () => {
    await shutdownTracing();
  });

  it('returns a NoopSpan by default and span methods do not throw', () => {
    const span = getTracer().startSpan('x');

    expect(span).toBeDefined();
    expect(() => span.setAttribute('key', 'value')).not.toThrow();
    expect(() => span.setStatus('OK')).not.toThrow();
    expect(() => span.recordException(new Error('boom'))).not.toThrow();
    expect(() => span.end()).not.toThrow();
  });

  it('returns undefined from injectTraceContext with no span and no active context before initTracing', () => {
    expect(injectTraceContext()).toBeUndefined();
  });

  it('performs a propagation round-trip after initTracing', () => {
    initTracing('test');

    const span = getTracer().startSpan('roundtrip');
    const carrier = injectTraceContext(span);

    expect(carrier).toBeDefined();
    expect(carrier).toHaveProperty('traceparent');
    expect(carrier?.traceparent).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/,
    );
    expect(extractTraceContext(carrier)).toBeDefined();

    span.end();
  });

  it('is idempotent when initTracing is called more than once', () => {
    expect(() => initTracing('test')).not.toThrow();
  });

  it('accepts typed attributes when starting a span', () => {
    const span = getTracer().startSpan('x', {
      attributes: { n: 1, s: 'a', b: true },
    });

    expect(span).toBeDefined();
    span.end();
  });
});
