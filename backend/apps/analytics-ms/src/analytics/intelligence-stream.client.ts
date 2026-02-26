import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type {
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
    await this.ensureConnected();
    const messageId = await this.redis.xadd(
      this.requestStream,
      '*',
      'payload',
      JSON.stringify(payload),
    );
    if (!messageId) {
      throw new Error('Redis did not return a message id for request stream');
    }
    return messageId;
  }

  async publishDlq(payload: Record<string, unknown>): Promise<string> {
    await this.ensureConnected();
    const messageId = await this.redis.xadd(
      this.dlqStream,
      '*',
      'payload',
      JSON.stringify(payload),
    );
    if (!messageId) {
      throw new Error('Redis did not return a message id for DLQ stream');
    }
    return messageId;
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
      if (typeof payload === 'string') {
        messages.push({ id, payload });
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

  private extractField(fields: string[], name: string): string | undefined {
    for (let index = 0; index < fields.length; index += 2) {
      if (fields[index] === name) {
        return fields[index + 1];
      }
    }
    return undefined;
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
