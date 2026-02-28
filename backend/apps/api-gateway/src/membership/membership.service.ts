import { GatewayTimeoutException, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  Observable,
  TimeoutError,
  catchError,
  firstValueFrom,
  timeout,
} from 'rxjs';
import { MICROSERVICE_TIMEOUT_MS } from '../constants';
import { createRpcClient } from '@app/common';
import type { IMembership } from '@app/common';

@Injectable()
export class MembershipService {
  private readonly groupsClient: ClientProxy;

  constructor(
    @Inject('GROUPS_SERVICE')
    groupsClient: ClientProxy,
  ) {
    this.groupsClient = createRpcClient(groupsClient);
  }

  async listByGroup(groupId: string): Promise<IMembership[]> {
    return this.sendWithTimeout(
      this.groupsClient.send<IMembership[]>(
        { cmd: 'membership.listByGroup' },
        groupId,
      ),
    );
  }

  async listByGroups(groupIds: string[]): Promise<IMembership[]> {
    return this.sendWithTimeout(
      this.groupsClient.send<IMembership[]>(
        { cmd: 'membership.listByGroups' },
        groupIds,
      ),
    );
  }

  async listByMember(memberId: string): Promise<IMembership[]> {
    return this.sendWithTimeout(
      this.groupsClient.send<IMembership[]>(
        { cmd: 'membership.listByMember' },
        memberId,
      ),
    );
  }

  async listByMembers(memberIds: string[]): Promise<IMembership[]> {
    return this.sendWithTimeout(
      this.groupsClient.send<IMembership[]>(
        { cmd: 'membership.listByMembers' },
        memberIds,
      ),
    );
  }

  async addMember(data: {
    groupId: string;
    memberId: string;
  }): Promise<IMembership> {
    return this.sendWithTimeout(
      this.groupsClient.send<IMembership>(
        { cmd: 'membership.createOne' },
        data,
      ),
    );
  }

  async removeMember(data: {
    groupId: string;
    memberId: string;
  }): Promise<boolean> {
    return this.sendWithTimeout(
      this.groupsClient.send<boolean>(
        { cmd: 'membership.removeByComposite' },
        data,
      ),
    );
  }

  private async sendWithTimeout<T>(observable: Observable<T>): Promise<T> {
    return firstValueFrom(
      observable.pipe(
        timeout(MICROSERVICE_TIMEOUT_MS),
        catchError((err) => {
          if (err instanceof TimeoutError) {
            throw new GatewayTimeoutException('Groups service timed out');
          }
          throw err;
        }),
      ),
    );
  }
}
