import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { context, propagation, SpanKind, trace } from '@opentelemetry/api';
import type {
  IntelligenceObservabilityMetadata,
  IntelligenceRequestEvent,
  StreamMessage,
} from './intelligence-stream.types';

@Injectable()
export class IntelligenceStreamClient implements OnModuleDestroy {
  private readonly logger = new Logger(IntelligenceStreamClient.name);

  private readonly redis: Redis;
  private readonly blockingRedis: Redis;

  private readonly requestStream =
    process.env.ANALYTICS_INTELLIGENCE_REQUEST_STREAM ||
    'analytics:intelligence:request:v1';

  private readonly resultStream =
    process.env.ANALYTICS_INTELLIGENCE_RESULT_STREAM ||
    'analytics:intelligence:result:v1';

  private readonly dlqStream =
    process.env.ANALYTICS_INTELLIGENCE_DLQ_STREAM ||
    'analytics:intelligence:dlq:v1';

  private readonly consumerGroup =
    process.env.ANALYTICS_INTELLIGENCE_CONSUMER_GROUP || 'analytics-ms';
  private readonly producerService =
    process.env.OTEL_SERVICE_NAME || 'analytics-ms';

  constructor() {
    const options = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
      lazyConnect: true,
    };
    this.redis = new Redis(options);
    this.blockingRedis = new Redis(options);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.closeRedisClient(this.redis),
      this.closeRedisClient(this.blockingRedis),
    ]);
  }

  async publishRequest(payload: IntelligenceRequestEvent): Promise<string> {
    return trace
      .getTracer('analytics-ms.intelligence-stream')
      .startActiveSpan(
        'redis.stream.publish.request',
        {
          kind: SpanKind.PRODUCER,
          attributes: {
            'messaging.system': 'redis',
            'messaging.destination': this.requestStream,
            'db.system': 'redis',
            'db.operation': 'xadd',
          },
        },
        async (span) => {
          try {
            await this.ensureConnected();
            const metadata = this.buildObservabilityMetadata();
            const messageId = await this.redis.xadd(
              this.requestStream,
              ...this.buildXAddArgs(payload, metadata),
            );
            if (!messageId) {
              throw new Error(
                'Redis did not return a message id for request stream',
              );
            }
            return messageId;
          } catch (error) {
            span.recordException(error as Error);
            span.setStatus({ code: 2, message: String(error) });
            throw error;
          } finally {
            span.end();
          }
        },
      );
  }

  async publishDlq(payload: Record<string, unknown>): Promise<string> {
    return trace
      .getTracer('analytics-ms.intelligence-stream')
      .startActiveSpan(
        'redis.stream.publish.dlq',
        {
          kind: SpanKind.PRODUCER,
          attributes: {
            'messaging.system': 'redis',
            'messaging.destination': this.dlqStream,
            'db.system': 'redis',
            'db.operation': 'xadd',
          },
        },
        async (span) => {
          try {
            await this.ensureConnected();
            const metadata = this.buildObservabilityMetadata();
            const messageId = await this.redis.xadd(
              this.dlqStream,
              ...this.buildXAddArgs(payload, metadata),
            );
            if (!messageId) {
              throw new Error('Redis did not return a message id for DLQ stream');
            }
            return messageId;
          } catch (error) {
            span.recordException(error as Error);
            span.setStatus({ code: 2, message: String(error) });
            throw error;
          } finally {
            span.end();
          }
        },
      );
  }

  async ensureResultConsumerGroup(): Promise<void> {
    await this.ensureConnected();
    try {
      await this.redis.xgroup(
        'CREATE',
        this.resultStream,
        this.consumerGroup,
        '$',
        'MKSTREAM',
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      if (!message.includes('BUSYGROUP')) {
        throw error;
      }
      this.logger.debug('Result stream consumer group already exists.');
    }
  }

  async readResultMessages(
    consumerName: string,
    count: number,
    blockMs: number,
  ): Promise<StreamMessage[]> {
    await this.ensureConnected(this.blockingRedis);

    const response = (await (this.blockingRedis as unknown as {
      xreadgroup: (...args: string[]) => Promise<
        Array<[string, Array<[string, string[]]>]> | null
      >;
    }).xreadgroup(
      'GROUP',
      this.consumerGroup,
      consumerName,
      'COUNT',
      String(Math.max(1, count)),
      'BLOCK',
      String(Math.max(0, blockMs)),
      'STREAMS',
      this.resultStream,
      '>',
    )) as Array<[string, Array<[string, string[]]>]> | null;

    if (!response || response.length === 0) {
      return [];
    }

    const [, entries] = response[0] || [];
    if (!entries || entries.length === 0) {
      return [];
    }

    const messages: StreamMessage[] = [];
    for (const [id, fields] of entries) {
      const payload = this.extractField(fields, 'payload');
      const metadata = this.extractObservabilityMetadata(fields);
      if (typeof payload === 'string') {
        messages.push({ id, payload, metadata });
        continue;
      }
      this.logger.warn(
        `Result stream message ${id} does not contain a payload field`,
      );
      messages.push({
        id,
        payload: JSON.stringify({
          error: 'Missing payload field',
          fields,
        }),
      });
    }

    return messages;
  }

  async ackResultMessage(id: string): Promise<void> {
    await this.ensureConnected();
    await this.redis.xack(this.resultStream, this.consumerGroup, id);
  }

  getResultStream(): string {
    return this.resultStream;
  }

  getDlqStream(): string {
    return this.dlqStream;
  }

  private buildObservabilityMetadata(): IntelligenceObservabilityMetadata {
    const carrier: Record<string, string> = {};
    propagation.inject(context.active(), carrier);
    if (!carrier.traceparent) {
      throw new Error('Could not inject traceparent from active context');
    }

    return {
      traceparent: carrier.traceparent,
      tracestate: carrier.tracestate,
      baggage: carrier.baggage,
      producer_service: this.producerService,
      produced_at: new Date().toISOString(),
    };
  }

  private buildXAddArgs(
    payload: unknown,
    metadata: IntelligenceObservabilityMetadata,
  ): string[] {
    const args = [
      '*',
      'payload',
      JSON.stringify(payload),
      'traceparent',
      metadata.traceparent,
      'producer_service',
      metadata.producer_service,
      'produced_at',
      metadata.produced_at,
    ];

    if (metadata.tracestate) {
      args.push('tracestate', metadata.tracestate);
    }
    if (metadata.baggage) {
      args.push('baggage', metadata.baggage);
    }

    return args;
  }

  private extractField(fields: string[], name: string): string | undefined {
    for (let index = 0; index < fields.length; index += 2) {
      if (fields[index] === name) {
        return fields[index + 1];
      }
    }
    return undefined;
  }

  private extractObservabilityMetadata(
    fields: string[],
  ): Partial<IntelligenceObservabilityMetadata> | undefined {
    const traceparent = this.extractField(fields, 'traceparent');
    const producerService = this.extractField(fields, 'producer_service');
    const producedAt = this.extractField(fields, 'produced_at');
    if (!traceparent && !producerService && !producedAt) {
      return undefined;
    }
    return {
      traceparent: traceparent || '',
      tracestate: this.extractField(fields, 'tracestate'),
      baggage: this.extractField(fields, 'baggage'),
      producer_service: producerService || 'unknown',
      produced_at: producedAt || new Date().toISOString(),
    };
  }

  private async ensureConnected(client: Redis = this.redis): Promise<void> {
    if (client.status === 'ready' || client.status === 'connect') {
      return;
    }
    await client.connect();
  }

  private async closeRedisClient(client: Redis): Promise<void> {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
}
