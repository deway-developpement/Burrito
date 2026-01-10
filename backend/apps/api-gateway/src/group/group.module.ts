import { Module, forwardRef } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { GroupService } from './group.service';
import { GroupResolver } from './group.resolver';
import { GroupDto } from './dto/group.dto';
import { CreateGroupInput } from './dto/create-group.input';
import { UpdateGroupInput } from './dto/update-group.input';
import { MembershipModule } from '../membership/membership.module';
import { UserModule } from '../user/user.module';
import { GroupByIdLoader } from '../loaders/group-by-id.loader';
import { GroupFormModule } from '../group-form/group-form.module';
import { FormModule } from '../form/form.module';

@Module({
  imports: [
    NestjsQueryGraphQLModule.forFeature({
      imports: [
        ClientsModule.registerAsync([
          {
            name: 'GROUPS_SERVICE',
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
      services: [GroupService],
      dtos: [
        {
          DTOClass: GroupDto,
          CreateDTOClass: CreateGroupInput,
          UpdateDTOClass: UpdateGroupInput,
        },
      ],
    }),
    MembershipModule,
    GroupFormModule,
    forwardRef(() => UserModule),
    forwardRef(() => FormModule),
  ],
  providers: [GroupResolver, GroupService, GroupByIdLoader],
  exports: [GroupService, GroupByIdLoader],
})
export class GroupModule {}
