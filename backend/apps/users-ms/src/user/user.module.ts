import { Module } from '@nestjs/common';
import { User, UserSchema } from './entities/user.entity';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryMongooseModule } from '@nestjs-query/query-mongoose';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
  imports: [
    NestjsQueryGraphQLModule.forFeature({
      imports: [
        NestjsQueryMongooseModule.forFeature([
          {
            document: User,
            name: User.name,
            schema: UserSchema,
          },
        ]),
      ],
      services: [UserService],
    }),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
