import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { LoggerModule } from 'nestjs-pino';
import {
  configuration,
  validation,
  MetricsController,
  PrometheusService,
  RedisLoggerInterceptor,
} from '@app/common';
import { NotificationsMsController } from './notifications-ms.controller';
import { NotificationsMsService } from './notifications-ms.service';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        base: { service: 'notifications-ms' },
        autoLogging: false,
        redact: ['req.headers.authorization'],
      },
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
    NotificationModule,
  ],
  controllers: [NotificationsMsController, MetricsController],
  providers: [
    NotificationsMsService,
    PrometheusService,
    RedisLoggerInterceptor,
  ],
})
export class NotificationsMsModule {}
