import {
  context,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  trace,
  Tracer,
} from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';

type RedisHeaders = {
  traceparent?: string;
  tracestate?: string;
  baggage?: string;
  producer_service?: string;
  produced_at?: string;
};

type RedisPacket = {
  pattern?: unknown;
  id?: string;
  headers?: RedisHeaders;
  data?: unknown;
};

type RedisHandleMessage = (
  channel: string,
  buffer: string,
  pub: unknown,
  pattern: string,
) => Promise<void>;

declare global {
  // eslint-disable-next-line no-var
  var __burritoOtelSdk: NodeSDK | undefined;
  // eslint-disable-next-line no-var
  var __burritoRedisTracingPatched: boolean | undefined;
}

const TEXT_MAP_GETTER = {
  get(carrier: RedisHeaders, key: string): string | undefined {
    return carrier?.[key as keyof RedisHeaders];
  },
  keys(carrier: RedisHeaders): string[] {
    return Object.keys(carrier || {});
  },
};

const TEXT_MAP_SETTER = {
  set(carrier: RedisHeaders, key: string, value: string): void {
    carrier[key as keyof RedisHeaders] = value;
  },
};

function getTelemetryServiceName(serviceName: string): string {
  return process.env.OTEL_SERVICE_NAME || serviceName;
}

function getTelemetryNamespace(): string {
  return process.env.OTEL_SERVICE_NAMESPACE || 'burrito';
}

function getEnvironment(): string {
  return (
    process.env.OTEL_RESOURCE_DEPLOYMENT_ENVIRONMENT ||
    process.env.NODE_ENV ||
    'development'
  );
}

function getTracer(serviceName: string): Tracer {
  return trace.getTracer(`${serviceName}.telemetry`);
}

function tryRequire<T>(moduleName: string): T | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(moduleName) as T;
  } catch {
    return null;
  }
}

function getPacketHeaders(packet: unknown): RedisHeaders {
  if (!packet || typeof packet !== 'object') {
    return {};
  }
  const candidate = (packet as RedisPacket).headers;
  if (!candidate || typeof candidate !== 'object') {
    return {};
  }
  return candidate;
}

function enrichRedisPacket<T extends RedisPacket>(
  packet: T,
  serviceName: string,
): T {
  const now = new Date().toISOString();
  const headers: RedisHeaders = {
    ...packet.headers,
    producer_service: serviceName,
    produced_at: now,
  };
  propagation.inject(context.active(), headers, TEXT_MAP_SETTER);
  return {
    ...packet,
    headers,
  };
}

export function getActiveTraceLogFields(): Record<string, string> {
  const span = trace.getSpan(context.active());
  const spanContext = span?.spanContext();
  if (!spanContext) {
    return {};
  }
  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
  };
}

export function buildRedisTransportOptions(): {
  host: string;
  port: number;
  retryAttempts: number;
  retryDelay: number;
} {
  return {
    port: parseInt(process.env.REDIS_PORT || '6379'),
    host: process.env.REDIS_HOST || 'localhost',
    retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '1000000'),
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY_MS || '1000'),
  };
}

export function initOpenTelemetry(serviceName: string): void {
  if (process.env.OTEL_SDK_DISABLED === 'true') {
    return;
  }
  if (globalThis.__burritoOtelSdk) {
    return;
  }

  propagation.setGlobalPropagator(
    new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
    }),
  );

  const exporter = new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      'http://otel-collector.monitoring.svc.cluster.local:4318/v1/traces',
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
      ? Object.fromEntries(
          process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((entry) => {
              const [key, ...rest] = entry.split('=');
              return [key, rest.join('=')];
            }),
        )
      : undefined,
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': getTelemetryServiceName(serviceName),
      'service.namespace': getTelemetryNamespace(),
      'deployment.environment': getEnvironment(),
      'service.version': process.env.npm_package_version || '0.0.0',
      'burrito.namespace':
        process.env.BURRITO_NAMESPACE || process.env.K8S_NAMESPACE || 'unknown',
    }),
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  void Promise.resolve(sdk.start()).catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('OpenTelemetry SDK failed to start', error);
  });

  globalThis.__burritoOtelSdk = sdk;

  const shutdown = () => {
    void sdk.shutdown().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('OpenTelemetry SDK shutdown failed', error);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

export function setupRedisRpcTracingBridge(serviceName: string): void {
  if (globalThis.__burritoRedisTracingPatched) {
    return;
  }
  // NestJS microservices internals require Reflect metadata to be initialized.
  tryRequire('reflect-metadata');

  const clientModule = tryRequire<{
    ClientRedis?: {
      prototype: {
        publish?: (
          partialPacket: RedisPacket,
          callback: (...args: unknown[]) => void,
        ) => () => void;
        dispatchEvent?: (packet: RedisPacket) => Promise<unknown>;
      };
    };
  }>('@nestjs/microservices/client/client-redis');

  const serverModule = tryRequire<{
    ServerRedis?: {
      prototype: {
        handleMessage?: RedisHandleMessage;
        parseMessage?: (buffer: string) => unknown;
      };
    };
  }>('@nestjs/microservices/server/server-redis');
  let patched = false;

  if (clientModule?.ClientRedis?.prototype?.publish) {
    const originalPublish = clientModule.ClientRedis.prototype.publish;
    clientModule.ClientRedis.prototype.publish = function patchedPublish(
      partialPacket: RedisPacket,
      callback: (...args: unknown[]) => void,
    ): () => void {
      const patternLabel = String(partialPacket?.pattern ?? 'unknown');
      const tracer = getTracer(serviceName);
      return tracer.startActiveSpan(
        `redis.rpc.produce ${patternLabel}`,
        {
          kind: SpanKind.PRODUCER,
          attributes: {
            'messaging.system': 'redis',
            'messaging.destination': patternLabel,
            'db.system': 'redis',
            'db.operation': 'publish',
          },
        },
        (span) => {
          try {
            const enrichedPacket = enrichRedisPacket(partialPacket, serviceName);
            return originalPublish.call(this, enrichedPacket, callback);
          } catch (error) {
            span.recordException(error as Error);
            span.setStatus({ code: 2, message: String(error) });
            throw error;
          } finally {
            span.end();
          }
        },
      );
    };
    patched = true;
  }

  if (clientModule?.ClientRedis?.prototype?.dispatchEvent) {
    const originalDispatchEvent = clientModule.ClientRedis.prototype.dispatchEvent;
    clientModule.ClientRedis.prototype.dispatchEvent =
      function patchedDispatchEvent(packet: RedisPacket): Promise<unknown> {
        const patternLabel = String(packet?.pattern ?? 'unknown');
        const tracer = getTracer(serviceName);
        return tracer.startActiveSpan(
          `redis.event.produce ${patternLabel}`,
          {
            kind: SpanKind.PRODUCER,
            attributes: {
              'messaging.system': 'redis',
              'messaging.destination': patternLabel,
              'db.system': 'redis',
              'db.operation': 'publish',
            },
          },
          async (span) => {
            try {
              const enrichedPacket = enrichRedisPacket(packet, serviceName);
              return await originalDispatchEvent.call(this, enrichedPacket);
            } catch (error) {
              span.recordException(error as Error);
              span.setStatus({ code: 2, message: String(error) });
              throw error;
            } finally {
              span.end();
            }
          },
        );
      };
    patched = true;
  }

  if (serverModule?.ServerRedis?.prototype?.handleMessage) {
    const originalHandleMessage = serverModule.ServerRedis.prototype.handleMessage;
    serverModule.ServerRedis.prototype.handleMessage = async function patchedHandleMessage(
      this: {
        parseMessage?: (buffer: string) => unknown;
      },
      channel: string,
      buffer: string,
      pub: unknown,
      pattern: string,
    ): Promise<void> {
      const rawMessage =
        typeof this.parseMessage === 'function' ? this.parseMessage(buffer) : {};
      const headers = getPacketHeaders(rawMessage);
      const extractedContext = propagation.extract(
        ROOT_CONTEXT,
        headers,
        TEXT_MAP_GETTER,
      );
      const tracer = getTracer(serviceName);
      const patternLabel = String(pattern || channel || 'unknown');

      return tracer.startActiveSpan(
        `redis.rpc.consume ${patternLabel}`,
        {
          kind: SpanKind.CONSUMER,
          attributes: {
            'messaging.system': 'redis',
            'messaging.destination': patternLabel,
            'db.system': 'redis',
            'db.operation': 'consume',
            'messaging.producer_service': headers.producer_service || 'unknown',
          },
        },
        extractedContext,
        async (span) => {
          try {
            await originalHandleMessage.call(this, channel, buffer, pub, pattern);
          } catch (error) {
            span.recordException(error as Error);
            span.setStatus({ code: 2, message: String(error) });
            throw error;
          } finally {
            span.end();
          }
        },
      );
    };
    patched = true;
  }

  if (patched) {
    globalThis.__burritoRedisTracingPatched = true;
  }
}
