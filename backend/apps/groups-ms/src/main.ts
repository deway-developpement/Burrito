import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { RedisLoggerInterceptor } from '@app/common';
import { Logger } from 'nestjs-pino';
import { GroupsMsModule } from './groups-ms.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    GroupsMsModule,
    {
      transport: Transport.REDIS,
      options: {
        port: parseInt(process.env.REDIS_PORT || '6379'),
        host: process.env.REDIS_HOST || 'localhost',
      },
      bufferLogs: true,
    },
  );
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(app.get(RedisLoggerInterceptor));
  await app.listen();
}

void bootstrap();
