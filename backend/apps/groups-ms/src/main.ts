import './telemetry.bootstrap';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  RedisLoggerInterceptor,
  buildRedisTransportOptions,
} from '@app/common';
import { Logger } from 'nestjs-pino';
import { GroupsMsModule } from './groups-ms.module';


async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    GroupsMsModule,
    {
      transport: Transport.REDIS,
      options: buildRedisTransportOptions(),
      bufferLogs: true,
    },
  );
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(app.get(RedisLoggerInterceptor));
  await app.listen();
}

void bootstrap();
