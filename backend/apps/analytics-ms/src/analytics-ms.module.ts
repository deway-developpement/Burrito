import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import {
  configuration,
  validation,
  MetricsController,
  PrometheusService,
  RedisLoggerInterceptor,
  createPinoHttpOptions,
} from '@app/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { LoggerModule } from 'nestjs-pino';
import { AnalyticsModule } from './analytics/analytics.module';
import { AnalyticsMsController } from './analytics-ms.controller';
import { AnalyticsMsService } from './analytics-ms.service';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: createPinoHttpOptions('analytics-ms'),
    }),
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [configuration.configuration],
      isGlobal: true,
      validationSchema: validation.validationSchema,
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: `mongodb://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.MONGODB_MODE == 'docker' ? process.env.MONGODB_CONTAINER_NAME : 'localhost'}:${process.env.MONGODB_PORT}/${process.env.DATABASE_NAME}?authSource=admin`,
      }),
    }),
    PrometheusModule.register({ defaultMetrics: { enabled: true } }),
    AnalyticsModule,
  ],
  controllers: [AnalyticsMsController, MetricsController],
  providers: [AnalyticsMsService, PrometheusService, RedisLoggerInterceptor],
})
export class AnalyticsMsModule {}
