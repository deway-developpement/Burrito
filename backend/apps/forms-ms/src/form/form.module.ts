import { Module } from '@nestjs/common';
import { Form, FormSchema } from './entities/form.entity';
import { FormService } from './form.service';
import { FormController } from './form.controller';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryMongooseModule } from '@nestjs-query/query-mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';

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
        ClientsModule.registerAsync([
          {
            name: 'NOTIFICATIONS_EVENTS',
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
    }),
  ],
  providers: [FormService],
  controllers: [FormController],
  exports: [FormService],
})
export class FormModule {}
