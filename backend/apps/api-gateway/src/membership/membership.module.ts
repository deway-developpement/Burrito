import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MembershipService } from './membership.service';
import { MembershipsByGroupLoader } from '../loaders/memberships-by-group.loader';
import { MembershipsByMemberLoader } from '../loaders/memberships-by-member.loader';

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
            retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '1000000'),
            retryDelay: parseInt(process.env.REDIS_RETRY_DELAY_MS || '1000'),
          },
        }),
      },
    ]),
  ],
  providers: [
    MembershipService,
    MembershipsByGroupLoader,
    MembershipsByMemberLoader,
  ],
  exports: [
    MembershipService,
    MembershipsByGroupLoader,
    MembershipsByMemberLoader,
  ],
})
export class MembershipModule {}
