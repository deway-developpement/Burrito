import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { GroupFormService } from './group-form.service';
import { GroupFormsByGroupLoader } from '../loaders/group-forms-by-group.loader';
import { GroupFormsByFormLoader } from '../loaders/group-forms-by-form.loader';

@Module({
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
  providers: [
    GroupFormService,
    GroupFormsByGroupLoader,
    GroupFormsByFormLoader,
  ],
  exports: [GroupFormService, GroupFormsByGroupLoader, GroupFormsByFormLoader],
})
export class GroupFormModule {}
