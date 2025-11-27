import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { RedisLoggerInterceptor } from '@app/common';
import { FormsMsModule } from './forms-ms.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    FormsMsModule,
    {
      transport: Transport.REDIS,
      options: {
        port: parseInt(process.env.REDIS_PORT || '6379'),
        host: process.env.REDIS_HOST || 'localhost',
      },
    },
  );
  app.useGlobalInterceptors(new RedisLoggerInterceptor());
  await app.listen();
}

void bootstrap();
