import { Module, forwardRef } from '@nestjs/common';
import { UserService } from './user.service';
import { UserResolver } from './user.resolver';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { UserDto } from './dto/user.dto';
import { UpdateUserInput } from './dto/update-user.input';
import { CreateUserInput } from './dto/create-user.input';
import { MembershipModule } from '../membership/membership.module';
import { GroupModule } from '../group/group.module';
import { UserByIdLoader } from '../loaders/user-by-id.loader';

@Module({
  imports: [
    NestjsQueryGraphQLModule.forFeature({
      imports: [
        ClientsModule.registerAsync([
          {
            name: 'USER_SERVICE',
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
      services: [UserService],
      dtos: [
        {
          DTOClass: UserDto,
          UpdateDTOClass: UpdateUserInput,
          CreateDTOClass: CreateUserInput,
        },
      ],
    }),
    MembershipModule,
    forwardRef(() => GroupModule),
  ],
  providers: [UserResolver, UserService, UserByIdLoader],
  exports: [UserService, UserByIdLoader],
})
export class UserModule {}
