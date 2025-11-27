import { Module } from '@nestjs/common';
import { Form, FormSchema } from './entities/form.entity';
import { FormService } from './form.service';
import { FormController } from './form.controller';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryMongooseModule } from '@nestjs-query/query-mongoose';

@Module({
  imports: [
    NestjsQueryGraphQLModule.forFeature({
      imports: [
        NestjsQueryMongooseModule.forFeature([
          {
            document: Form,
            name: Form.name,
            schema: FormSchema,
          },
        ]),
      ],
      services: [FormService],
    }),
  ],
  providers: [FormService],
  controllers: [FormController],
  exports: [FormService],
})
export class FormModule {}
