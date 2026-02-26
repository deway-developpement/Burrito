import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { RedisLoggerInterceptor } from '@app/common';
import { NotificationsMsModule } from './notifications-ms.module';

async function bootstrap() {
  const app = await NestFactory.create(NotificationsMsModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(app.get(RedisLoggerInterceptor));

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.REDIS,
    options: {
      port: parseInt(process.env.REDIS_PORT || '6379'),
      host: process.env.REDIS_HOST || 'localhost',
      retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '1000000'),
      retryDelay: parseInt(process.env.REDIS_RETRY_DELAY_MS || '1000'),
    },
  });

  await app.startAllMicroservices();

  const port = parseInt(
    process.env.NOTIFICATIONS_HTTP_PORT || process.env.PORT || '3000',
  );
  await app.listen(port);
}

void bootstrap();
