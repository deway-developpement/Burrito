import { Module } from '@nestjs/common';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryMongooseModule } from '@nestjs-query/query-mongoose';
import { Group, GroupSchema } from './entities/group.entity';
import { GroupService } from './group.service';
import { GroupController } from './group.controller';

@Module({
  imports: [
    NestjsQueryGraphQLModule.forFeature({
      imports: [
        NestjsQueryMongooseModule.forFeature([
          {
            document: Group,
            name: Group.name,
            schema: GroupSchema,
          },
        ]),
      ],
      services: [GroupService],
    }),
  ],
  providers: [GroupService],
  controllers: [GroupController],
  exports: [GroupService],
})
export class GroupModule {}
