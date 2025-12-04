import { NestFactory } from '@nestjs/core';
import { EvaluationsMsModule } from './evaluations-ms.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { RedisLoggerInterceptor } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    EvaluationsMsModule,
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
