import { Module, forwardRef } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { FormService } from './form.service';
import { FormDto } from './dto/form.dto';
import { UpdateFormInput } from './dto/update-form.input';
import { FormResolver } from './form.resolver';
import { CreateFormInput } from './dto/create-form.input';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { GroupFormModule } from '../group-form/group-form.module';
import { GroupModule } from '../group/group.module';
import { FormByIdLoader } from '../loaders/form-by-id.loader';
import { UserModule } from '../user/user.module';

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
                retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '1000000'),
                retryDelay: parseInt(process.env.REDIS_RETRY_DELAY_MS || '1000'),
              },
            }),
          },
        ]),
        forwardRef(() => UserModule),
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
    GroupFormModule,
    forwardRef(() => GroupModule),
    forwardRef(() => UserModule),
  ],
  providers: [FormResolver, FormService, FormByIdLoader],
  exports: [FormService, FormByIdLoader],
})
export class FormModule {}
