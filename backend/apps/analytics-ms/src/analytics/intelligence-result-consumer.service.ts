import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AnalyticsService } from './analytics.service';
import { IntelligenceStreamClient } from './intelligence-stream.client';
import type { IntelligenceResultEvent } from './intelligence-stream.types';

@Injectable()
export class IntelligenceResultConsumerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(IntelligenceResultConsumerService.name);

  private readonly consumerName = `analytics-ms-${process.pid}-${randomUUID().slice(0, 8)}`;

  private readonly batchSize = Math.max(
    1,
    parseInt(process.env.ANALYTICS_INTELLIGENCE_RESULT_BATCH_SIZE || '20'),
  );

  private readonly blockMs = Math.max(
    100,
    parseInt(process.env.ANALYTICS_INTELLIGENCE_RESULT_BLOCK_MS || '2000'),
  );

  private running = false;

  private loopPromise?: Promise<void>;

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly streamClient: IntelligenceStreamClient,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.analyticsService.isIntelligenceEnabled()) {
      return;
    }

    await this.streamClient.ensureResultConsumerGroup();
    this.running = true;
    this.loopPromise = this.consumeLoop();
    this.logger.log(
      `Started intelligence result consumer on stream ${this.streamClient.getResultStream()} with consumer ${this.consumerName}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    if (this.loopPromise) {
      await this.loopPromise;
    }
  }

  private async consumeLoop(): Promise<void> {
    while (this.running) {
      try {
        const messages = await this.streamClient.readResultMessages(
          this.consumerName,
          this.batchSize,
          this.blockMs,
        );

        for (const message of messages) {
          await this.processMessage(message.id, message.payload);
        }

        await this.analyticsService.failTimedOutPendingSnapshots();
      } catch (error) {
        this.logger.warn(
          `Result consumer loop error: ${this.analyticsService.describeError(error)}`,
        );
        await this.sleep(1000);
      }
    }
  }

  private async processMessage(id: string, rawPayload: string): Promise<void> {
    try {
      const payload = JSON.parse(rawPayload) as IntelligenceResultEvent;
      await this.analyticsService.applyIntelligenceResult(payload);
      await this.streamClient.ackResultMessage(id);
    } catch (error) {
      const errorMessage = this.analyticsService.describeError(error);
      this.logger.warn(
        `Failed to process intelligence result message ${id}: ${errorMessage}`,
      );
      await this.streamClient.publishDlq({
        sourceStream: this.streamClient.getResultStream(),
        dlqStream: this.streamClient.getDlqStream(),
        failedMessageId: id,
        payload: rawPayload,
        error: errorMessage,
        failedAt: new Date().toISOString(),
      });
      await this.streamClient.ackResultMessage(id);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
