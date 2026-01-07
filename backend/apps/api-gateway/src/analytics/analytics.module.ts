import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AnalyticsResolver } from './analytics.resolver';
import { AnalyticsService } from './analytics.service';

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
          },
        }),
      },
    ]),
  ],
  providers: [AnalyticsResolver, AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
