import { Module } from '@nestjs/common';
import { UsersMsController } from './users-ms.controller';
import { UsersMsService } from './users-ms.service';
import { UserModule } from './user/user.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { configuration } from '@app/common';
import { validation } from '@app/common';
import { AuthModule } from './auth/auth.module';
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
        base: { service: 'users-ms' },
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
    UserModule,
    AuthModule,
  ],
  controllers: [UsersMsController, MetricsController],
  providers: [UsersMsService, PrometheusService, RedisLoggerInterceptor],
})
export class UsersMsModule {}
