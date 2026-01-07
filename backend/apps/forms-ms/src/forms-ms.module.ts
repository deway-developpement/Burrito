import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { configuration } from '@app/common';
import { validation } from '@app/common';
import { FormsMsController } from './forms-ms.controller';
import { FormsMsService } from './forms-ms.service';
import { FormModule } from './form/form.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import {
  MetricsController,
  PrometheusService,
  RedisLoggerInterceptor,
} from '@app/common';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        base: { service: 'forms-ms' },
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
      useFactory: () => {
        return {
          uri: `mongodb://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.MONGODB_MODE == 'docker' ? process.env.MONGODB_CONTAINER_NAME : 'localhost'}:${process.env.MONGODB_PORT}/${process.env.DATABASE_NAME}?authSource=admin`,
        };
      },
    }),
    PrometheusModule.register({ defaultMetrics: { enabled: true } }),
    FormModule,
  ],
  controllers: [FormsMsController, MetricsController],
  providers: [FormsMsService, PrometheusService, RedisLoggerInterceptor],
})
export class FormsMsModule {}
