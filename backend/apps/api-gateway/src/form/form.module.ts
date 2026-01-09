import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { FormService } from './form.service';
import { FormDto } from './dto/form.dto';
import { UpdateFormInput } from './dto/update-form.input';
import { FormResolver } from './form.resolver';
import { CreateFormInput } from './dto/create-form.input';
import { EvaluationModule } from '../evaluation/evaluation.module';

@Module({
  imports: [
    NestjsQueryGraphQLModule.forFeature({
      imports: [
        ClientsModule.registerAsync([
          {
            name: 'FORM_SERVICE',
            useFactory: () => ({
              transport: Transport.REDIS,
              options: {
                port: parseInt(process.env.REDIS_PORT || '6379'),
                host: process.env.REDIS_HOST || 'localhost',
              },
            }),
          },
        ]),
      ],
      services: [FormService],
      dtos: [
        {
          DTOClass: FormDto,
          UpdateDTOClass: UpdateFormInput,
          CreateDTOClass: CreateFormInput,
        },
      ],
    }),
    EvaluationModule,
  ],
  providers: [FormResolver, FormService],
  exports: [FormService],
})
export class FormModule {}
