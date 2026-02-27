import './telemetry.bootstrap';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import {
  RedisLoggerInterceptor,
  buildRedisTransportOptions,
} from '@app/common';
import { NotificationsMsModule } from './notifications-ms.module';


async function bootstrap() {
  const app = await NestFactory.create(NotificationsMsModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(app.get(RedisLoggerInterceptor));

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.REDIS,
    options: buildRedisTransportOptions(),
  });

  await app.startAllMicroservices();

  const port = parseInt(
    process.env.NOTIFICATIONS_HTTP_PORT || process.env.PORT || '3000',
  );
  await app.listen(port);
}

void bootstrap();
