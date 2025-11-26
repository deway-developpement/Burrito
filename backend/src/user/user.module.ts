import { Module } from '@nestjs/common';
import { User, UserSchema } from './entities/user.entity';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryMongooseModule } from '@nestjs-query/query-mongoose';
import { UserDto } from './dto/user.dto';
import { UserService } from './user.service';
import { UpdateUserInput } from './dto/update-user.input';
import { CreateUserInput } from './dto/create-user.input';
import { UserResolver } from './user.resolver';

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
      dtos: [
        {
          DTOClass: UserDto,
          UpdateDTOClass: UpdateUserInput,
          CreateDTOClass: CreateUserInput,
        },
      ],
    }),
  ],
  providers: [UserResolver, UserService],
  exports: [UserService],
})
export class UserModule {}
