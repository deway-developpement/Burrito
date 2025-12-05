import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  await app.listen(process.env.port ?? 3000);
}
void bootstrap();
