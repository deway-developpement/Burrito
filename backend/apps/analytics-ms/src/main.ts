import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { RedisLoggerInterceptor } from '@app/common';
import { Logger } from 'nestjs-pino';
import { AnalyticsMsModule } from './analytics-ms.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AnalyticsMsModule,
    {
      transport: Transport.REDIS,
      options: {
        port: parseInt(process.env.REDIS_PORT || '6379'),
        host: process.env.REDIS_HOST || 'localhost',
        retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '1000000'),
        retryDelay: parseInt(process.env.REDIS_RETRY_DELAY_MS || '1000'),
      },
      bufferLogs: true,
    },
  );
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(app.get(RedisLoggerInterceptor));
  await app.listen();
}

void bootstrap();
