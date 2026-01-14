import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ApiGatewayModule } from './api-gateway.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule, { bufferLogs: true });
  const allowedOrigins = [
    process.env.CORS_ORIGINS,
    process.env.WEB_APP_URL || 'https://burrito.deway.fr',
    'http://localhost:4200',
    'http://127.0.0.1:4200',
  ]
    .filter(Boolean)
    .flatMap((value) => value!.split(','))
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => origin.replace(/\/+$/, ''))
    .filter((origin, index, allOrigins) => allOrigins.indexOf(origin) === index);

  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) return callback(null, true);
      return allowedOrigins.includes(requestOrigin)
        ? callback(null, true)
        : callback(new Error(`Origin ${requestOrigin} not allowed by CORS`), false);
    },
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
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.REDIS,
    options: {
      port: parseInt(process.env.REDIS_PORT || '6379'),
      host: process.env.REDIS_HOST || 'localhost',
    },
  });
  await app.startAllMicroservices();
  await app.listen(process.env.port ?? 3000);
}
void bootstrap();
