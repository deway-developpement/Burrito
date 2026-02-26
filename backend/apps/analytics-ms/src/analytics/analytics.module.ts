import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { IntelligenceStreamClient } from './intelligence-stream.client';
import { IntelligenceResultConsumerService } from './intelligence-result-consumer.service';
import {
  AnalyticsSnapshot,
  AnalyticsSnapshotSchema,
} from './entities/analytics-snapshot.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnalyticsSnapshot.name, schema: AnalyticsSnapshotSchema },
    ]),
    ClientsModule.registerAsync([
      {
        name: 'FORM_SERVICE',
        useFactory: () => ({
          transport: Transport.REDIS,
          options: {
            port: parseInt(process.env.REDIS_PORT || '6379'),
            host: process.env.REDIS_HOST || 'localhost',
            retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '1000000'),
            retryDelay: parseInt(process.env.REDIS_RETRY_DELAY_MS || '1000'),
          },
        }),
      },
      {
        name: 'EVALUATION_SERVICE',
        useFactory: () => ({
          transport: Transport.REDIS,
          options: {
            port: parseInt(process.env.REDIS_PORT || '6379'),
            host: process.env.REDIS_HOST || 'localhost',
            retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '1000000'),
            retryDelay: parseInt(process.env.REDIS_RETRY_DELAY_MS || '1000'),
          },
        }),
      },
      {
        name: 'ANALYTICS_EVENTS',
        useFactory: () => ({
          transport: Transport.REDIS,
          options: {
            port: parseInt(process.env.REDIS_PORT || '6379'),
            host: process.env.REDIS_HOST || 'localhost',
            retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '1000000'),
            retryDelay: parseInt(process.env.REDIS_RETRY_DELAY_MS || '1000'),
          },
        }),
      },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    IntelligenceStreamClient,
    IntelligenceResultConsumerService,
  ],
})
export class AnalyticsModule {}
