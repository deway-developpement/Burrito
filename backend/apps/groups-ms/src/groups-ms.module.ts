import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import {
  configuration,
  validation,
  MetricsController,
  PrometheusService,
  RedisLoggerInterceptor,
} from '@app/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { LoggerModule } from 'nestjs-pino';
import { GroupsMsController } from './groups-ms.controller';
import { GroupsMsService } from './groups-ms.service';
import { GroupModule } from './group/group.module';
import { MembershipModule } from './membership/membership.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        base: { service: 'groups-ms' },
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
    GroupModule,
    MembershipModule,
  ],
  controllers: [GroupsMsController, MetricsController],
  providers: [GroupsMsService, PrometheusService, RedisLoggerInterceptor],
})
export class GroupsMsModule {}
