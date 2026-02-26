import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import Redis from 'ioredis';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { AnalyticsEventsController } from './analytics.events.controller';
import { AnalyticsResolver } from './analytics.resolver';
import { AnalyticsService } from './analytics.service';
import {
  ANALYTICS_PUBSUB,
  AnalyticsSubscriptionService,
} from './analytics-subscription.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'ANALYTICS_SERVICE',
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
  controllers: [AnalyticsEventsController],
  providers: [
    AnalyticsResolver,
    AnalyticsService,
    AnalyticsSubscriptionService,
    {
      provide: ANALYTICS_PUBSUB,
      useFactory: () =>
        new RedisPubSub({
          publisher: new Redis({
            port: parseInt(process.env.REDIS_PORT || '6379'),
            host: process.env.REDIS_HOST || 'localhost',
          }),
          subscriber: new Redis({
            port: parseInt(process.env.REDIS_PORT || '6379'),
            host: process.env.REDIS_HOST || 'localhost',
          }),
        }),
    },
  ],
  exports: [AnalyticsService, AnalyticsSubscriptionService],
})
export class AnalyticsModule {}
