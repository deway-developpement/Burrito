import { context, propagation, trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';

declare global {
  var __burritoOtelSdk: NodeSDK | undefined;
}

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
      propagators: [
        new W3CTraceContextPropagator(),
        new W3CBaggagePropagator(),
      ],
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
    console.error('OpenTelemetry SDK failed to start', error);
  });

  globalThis.__burritoOtelSdk = sdk;

  const shutdown = () => {
    void sdk.shutdown().catch((error) => {
      console.error('OpenTelemetry SDK shutdown failed', error);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
