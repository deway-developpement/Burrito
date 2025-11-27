import { NestFactory } from '@nestjs/core';
import { UsersMsModule } from './users-ms.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    UsersMsModule,
    {
      transport: Transport.REDIS,
      options: {
        port: 6379,
        host: 'localhost',
      },
    },
  );
  await app.listen();
}

void bootstrap();
