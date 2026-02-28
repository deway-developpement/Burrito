import { ClientProxy } from '@nestjs/microservices';
import {
  context,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { Observable } from 'rxjs';

export type RpcObservabilityMetadata = {
  traceparent?: string;
  tracestate?: string;
  baggage?: string;
  producer_service?: string;
  produced_at?: string;
};

export type RpcEnvelope<T> = {
  payload: T;
  __burrito_observability: RpcObservabilityMetadata;
};

const OBSERVABILITY_KEY = '__burrito_observability';
const WRAPPED_CLIENTS = new WeakSet<object>();
const CLIENT_WRAPPERS = new WeakMap<object, ClientProxy>();

const TEXT_MAP_GETTER = {
  get(carrier: RpcObservabilityMetadata, key: string): string | undefined {
    return carrier?.[key as keyof RpcObservabilityMetadata];
  },
  keys(carrier: RpcObservabilityMetadata): string[] {
    return Object.keys(carrier || {});
  },
};

const TEXT_MAP_SETTER = {
  set(carrier: RpcObservabilityMetadata, key: string, value: string): void {
    carrier[key as keyof RpcObservabilityMetadata] = value;
  },
};

function getServiceName(): string {
  return process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || 'unknown';
}

function patternToLabel(pattern: unknown): string {
  if (typeof pattern === 'string') {
    return pattern;
  }
  if (
    pattern &&
    typeof pattern === 'object' &&
    'cmd' in (pattern as Record<string, unknown>)
  ) {
    const cmd = (pattern as { cmd?: unknown }).cmd;
    if (typeof cmd === 'string') {
      return cmd;
    }
  }
  try {
    return JSON.stringify(pattern);
  } catch {
    return 'unknown';
  }
}

function createEnvelope<T>(
  payload: T,
  producerService = getServiceName(),
): RpcEnvelope<T> {
  if (
    payload &&
    typeof payload === 'object' &&
    OBSERVABILITY_KEY in (payload as Record<string, unknown>) &&
    'payload' in (payload as Record<string, unknown>)
  ) {
    return payload as unknown as RpcEnvelope<T>;
  }

  const metadata: RpcObservabilityMetadata = {
    producer_service: producerService,
    produced_at: new Date().toISOString(),
  };
  propagation.inject(context.active(), metadata, TEXT_MAP_SETTER);
  return {
    payload,
    [OBSERVABILITY_KEY]: metadata,
  };
}

export function unwrapRpcEnvelope<T>(data: unknown): {
  payload: T;
  metadata?: RpcObservabilityMetadata;
} {
  if (!data || typeof data !== 'object') {
    return { payload: data as T };
  }

  const candidate = data as Partial<RpcEnvelope<T>> &
    Record<string, unknown> & { payload?: T };
  const metadataValue = candidate[OBSERVABILITY_KEY];
  const metadata: RpcObservabilityMetadata | undefined =
    metadataValue && typeof metadataValue === 'object'
      ? metadataValue
      : undefined;

  if (metadata && 'payload' in candidate) {
    return {
      payload: candidate.payload as T,
      metadata,
    };
  }

  return { payload: data as T };
}

export function extractRpcContext(
  metadata?: RpcObservabilityMetadata,
): ReturnType<typeof context.active> {
  if (!metadata) {
    return ROOT_CONTEXT;
  }
  return propagation.extract(ROOT_CONTEXT, metadata, TEXT_MAP_GETTER);
}

export function createRpcClient(client: ClientProxy): ClientProxy {
  const clientRef = client as unknown as object;
  if (WRAPPED_CLIENTS.has(clientRef)) {
    return client;
  }
  const cached = CLIENT_WRAPPERS.get(clientRef);
  if (cached) {
    return cached;
  }

  const producerService = getServiceName();
  const tracer = trace.getTracer(`${producerService}.rpc-client`);

  const wrappedClient = new Proxy(client, {
    get(target, prop) {
      if (prop === 'send') {
        return <TResponse = unknown, TPayload = unknown>(
          pattern: unknown,
          data: TPayload,
        ): Observable<TResponse> => {
          const label = patternToLabel(pattern);

          return new Observable<TResponse>((observer) => {
            let spanEnded = false;
            return tracer.startActiveSpan(
              `redis.rpc.produce ${label}`,
              {
                kind: SpanKind.PRODUCER,
                attributes: {
                  'messaging.system': 'redis',
                  'messaging.destination': label,
                  'db.system': 'redis',
                  'db.operation': 'publish',
                },
              },
              (span) => {
                const endSpan = () => {
                  if (!spanEnded) {
                    spanEnded = true;
                    span.end();
                  }
                };

                const envelope = createEnvelope(data, producerService);
                const subscription = target
                  .send<TResponse>(pattern as never, envelope)
                  .subscribe({
                    next: (value) => observer.next(value),
                    error: (error) => {
                      span.recordException(error as Error);
                      span.setStatus({
                        code: SpanStatusCode.ERROR,
                        message: String(error),
                      });
                      endSpan();
                      observer.error(error);
                    },
                    complete: () => {
                      endSpan();
                      observer.complete();
                    },
                  });

                return () => {
                  subscription.unsubscribe();
                  endSpan();
                };
              },
            );
          });
        };
      }

      if (prop === 'emit') {
        return <TPayload = unknown>(
          pattern: unknown,
          data: TPayload,
        ): Observable<unknown> => {
          const label = patternToLabel(pattern);

          return new Observable<unknown>((observer) => {
            let spanEnded = false;
            return tracer.startActiveSpan(
              `redis.event.produce ${label}`,
              {
                kind: SpanKind.PRODUCER,
                attributes: {
                  'messaging.system': 'redis',
                  'messaging.destination': label,
                  'db.system': 'redis',
                  'db.operation': 'publish',
                },
              },
              (span) => {
                const endSpan = () => {
                  if (!spanEnded) {
                    spanEnded = true;
                    span.end();
                  }
                };

                const envelope = createEnvelope(data, producerService);
                const subscription = target
                  .emit(pattern as never, envelope)
                  .subscribe({
                    next: (value) => observer.next(value),
                    error: (error) => {
                      span.recordException(error as Error);
                      span.setStatus({
                        code: SpanStatusCode.ERROR,
                        message: String(error),
                      });
                      endSpan();
                      observer.error(error);
                    },
                    complete: () => {
                      endSpan();
                      observer.complete();
                    },
                  });

                return () => {
                  subscription.unsubscribe();
                  endSpan();
                };
              },
            );
          });
        };
      }

      const targetRecord = target as unknown as Record<PropertyKey, unknown>;
      const value = targetRecord[prop];
      if (typeof value === 'function') {
        const callable = value as (
          this: ClientProxy,
          ...args: unknown[]
        ) => unknown;
        const boundCallable = callable.bind(target) as (
          ...args: unknown[]
        ) => unknown;
        return (...args: unknown[]) => boundCallable(...args);
      }
      return value;
    },
  });

  WRAPPED_CLIENTS.add(wrappedClient as object);
  CLIENT_WRAPPERS.set(clientRef, wrappedClient);
  return wrappedClient;
}
