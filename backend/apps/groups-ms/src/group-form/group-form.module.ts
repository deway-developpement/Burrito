import { Module } from '@nestjs/common';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryMongooseModule } from '@nestjs-query/query-mongoose';
import { GroupForm, GroupFormSchema } from './entities/group-form.entity';
import { GroupFormService } from './group-form.service';
import { GroupFormController } from './group-form.controller';

@Module({
  imports: [
    NestjsQueryGraphQLModule.forFeature({
      imports: [
        NestjsQueryMongooseModule.forFeature([
          {
            document: GroupForm,
            name: GroupForm.name,
            schema: GroupFormSchema,
          },
        ]),
      ],
      services: [GroupFormService],
    }),
  ],
  providers: [GroupFormService],
  controllers: [GroupFormController],
  exports: [GroupFormService],
})
export class GroupFormModule {}
