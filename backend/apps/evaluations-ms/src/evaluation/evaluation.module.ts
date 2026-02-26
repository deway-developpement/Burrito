import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryMongooseModule } from '@nestjs-query/query-mongoose';
import { Evaluation, EvaluationSchema } from './entities/evaluation.entity';
import { EvaluationService } from './evaluation.service';
import { EvaluationController } from './evaluation.controller';

@Module({
  imports: [
    NestjsQueryGraphQLModule.forFeature({
      imports: [
        NestjsQueryMongooseModule.forFeature([
          {
            document: Evaluation,
            name: Evaluation.name,
            schema: EvaluationSchema,
          },
        ]),
        ClientsModule.registerAsync([
          {
            name: 'USER_SERVICE',
            useFactory: () => ({
              transport: Transport.REDIS,
              options: {
                port: parseInt(process.env.REDIS_PORT || '6379'),
                host: process.env.REDIS_HOST || 'localhost',
                retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '1000000'),
                retryDelay: parseInt(process.env.REDIS_RETRY_DELAY_MS || '1000'),
              },
            }),
          },
          {
            name: 'GROUPS_SERVICE',
            useFactory: () => ({
              transport: Transport.REDIS,
              options: {
                port: parseInt(process.env.REDIS_PORT || '6379'),
                host: process.env.REDIS_HOST || 'localhost',
                retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '1000000'),
                retryDelay: parseInt(process.env.REDIS_RETRY_DELAY_MS || '1000'),
              },
            }),
          },
          {
            name: 'NOTIFICATIONS_EVENTS',
            useFactory: () => ({
              transport: Transport.REDIS,
              options: {
                port: parseInt(process.env.REDIS_PORT || '6379'),
                host: process.env.REDIS_HOST || 'localhost',
                retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '1000000'),
                retryDelay: parseInt(process.env.REDIS_RETRY_DELAY_MS || '1000'),
              },
            }),
          },
        ]),
      ],
      services: [EvaluationService],
    }),
  ],
  providers: [EvaluationService],
  controllers: [EvaluationController],
  exports: [EvaluationService],
})
export class EvaluationModule {}
