import { GatewayTimeoutException, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable, TimeoutError, catchError, firstValueFrom, timeout } from 'rxjs';
import { MICROSERVICE_TIMEOUT_MS } from '../constants';
import type { IGroupForm } from '@app/common';

@Injectable()
export class GroupFormService {
  constructor(
    @Inject('GROUPS_SERVICE')
    private readonly groupsClient: ClientProxy,
  ) {}

  async listByGroup(groupId: string): Promise<IGroupForm[]> {
    return this.sendWithTimeout(
      this.groupsClient.send<IGroupForm[]>({ cmd: 'groupForm.listByGroup' }, groupId),
    );
  }

  async listByGroups(groupIds: string[]): Promise<IGroupForm[]> {
    return this.sendWithTimeout(
      this.groupsClient.send<IGroupForm[]>(
        { cmd: 'groupForm.listByGroups' },
        groupIds,
      ),
    );
  }

  async listByForm(formId: string): Promise<IGroupForm[]> {
    return this.sendWithTimeout(
      this.groupsClient.send<IGroupForm[]>({ cmd: 'groupForm.listByForm' }, formId),
    );
  }

  async listByForms(formIds: string[]): Promise<IGroupForm[]> {
    return this.sendWithTimeout(
      this.groupsClient.send<IGroupForm[]>(
        { cmd: 'groupForm.listByForms' },
        formIds,
      ),
    );
  }

  async addForm(data: { groupId: string; formId: string }): Promise<IGroupForm> {
    return this.sendWithTimeout(
      this.groupsClient.send<IGroupForm>({ cmd: 'groupForm.createOne' }, data),
    );
  }

  async removeForm(data: { groupId: string; formId: string }): Promise<boolean> {
    return this.sendWithTimeout(
      this.groupsClient.send<boolean>(
        { cmd: 'groupForm.removeByComposite' },
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
