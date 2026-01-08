import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import type { IMembership } from '@app/common';
import { MembershipService } from '../membership/membership.service';

@Injectable({ scope: Scope.REQUEST })
export class MembershipsByGroupLoader {
  private readonly loader: DataLoader<string, IMembership[]>;

  constructor(private readonly membershipService: MembershipService) {
    this.loader = new DataLoader<string, IMembership[]>(async (groupIds) => {
      const memberships = await this.membershipService.listByGroups([
        ...groupIds,
      ]);
      const byGroupId = new Map<string, IMembership[]>();

      for (const groupId of groupIds) {
        byGroupId.set(groupId, []);
      }

      for (const membership of memberships) {
        const groupMemberships = byGroupId.get(membership.groupId);
        if (groupMemberships) {
          groupMemberships.push(membership);
        }
      }

      return groupIds.map((groupId) => byGroupId.get(groupId) ?? []);
    });
  }

  load(groupId: string): Promise<IMembership[]> {
    return this.loader.load(groupId);
  }

  loadMany(groupIds: readonly string[]) {
    return this.loader.loadMany(groupIds);
  }
}
