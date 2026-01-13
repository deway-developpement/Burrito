import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule, { bufferLogs: true });
  const webAppUrl = (
    process.env.WEB_APP_URL || 'https://burrito.deway.fr'
  ).replace(/\/+$/, '');

  app.enableCors({
    origin: [webAppUrl],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'refresh_token',
      'apollographql-client-name',
      'apollographql-client-version',
      'x-apollo-operation-name',
    ],
  });
  app.useLogger(app.get(Logger));
  await app.listen(process.env.port ?? 3000);
}
void bootstrap();
