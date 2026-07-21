export interface Tracer {
  startSpan(name: string): void;
  endSpan(): void;
  setAttribute(key: string, value: string | number | boolean): void;
  recordException(error: Error): void;
}

export class NoopTracer implements Tracer {
  startSpan(): void {
    // no-op
  }

  endSpan(): void {
    // no-op
  }

  setAttribute(): void {
    // no-op
  }

  recordException(): void {
    // no-op
  }
}

let tracer: Tracer = new NoopTracer();

export function setTracer(next: Tracer): void {
  tracer = next;
}

export function getTracer(): Tracer {
  return tracer;
}
