import { Module } from '@nestjs/common';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryMongooseModule } from '@nestjs-query/query-mongoose';
import { Membership, MembershipSchema } from './entities/membership.entity';
import { MembershipService } from './membership.service';
import { MembershipController } from './membership.controller';

@Module({
  imports: [
    NestjsQueryGraphQLModule.forFeature({
      imports: [
        NestjsQueryMongooseModule.forFeature([
          {
            document: Membership,
            name: Membership.name,
            schema: MembershipSchema,
          },
        ]),
      ],
      services: [MembershipService],
    }),
  ],
  providers: [MembershipService],
  controllers: [MembershipController],
  exports: [MembershipService],
})
export class MembershipModule {}
