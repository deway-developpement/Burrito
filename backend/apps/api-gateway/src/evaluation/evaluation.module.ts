import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { EvaluationService } from './evaluation.service';
import { EvaluationDto } from './dto/evaluation.dto';
import { UpdateEvaluationInput } from './dto/update-evaluation.input';
import { EvaluationResolver } from './evaluation.resolver';
import { CreateEvaluationInput } from './dto/create-evaluation.input';

@Module({
  imports: [
    NestjsQueryGraphQLModule.forFeature({
      imports: [
        ClientsModule.registerAsync([
          {
            name: 'EVALUATION_SERVICE',
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
      dtos: [
        {
          DTOClass: EvaluationDto,
          UpdateDTOClass: UpdateEvaluationInput,
          CreateDTOClass: CreateEvaluationInput,
        },
      ],
    }),
  ],
  providers: [EvaluationResolver, EvaluationService],
  exports: [EvaluationService],
})
export class EvaluationModule {}
