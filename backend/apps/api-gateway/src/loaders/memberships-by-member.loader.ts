import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import type { IMembership } from '@app/common';
import { MembershipService } from '../membership/membership.service';

@Injectable({ scope: Scope.REQUEST })
export class MembershipsByMemberLoader {
  private readonly loader: DataLoader<string, IMembership[]>;

  constructor(private readonly membershipService: MembershipService) {
    this.loader = new DataLoader<string, IMembership[]>(async (memberIds) => {
      const memberships = await this.membershipService.listByMembers([
        ...memberIds,
      ]);
      const byMember = new Map<string, IMembership[]>();

      for (const memberId of memberIds) {
        byMember.set(memberId, []);
      }

      for (const membership of memberships) {
        const memberMemberships = byMember.get(membership.memberId);
        if (memberMemberships) {
          memberMemberships.push(membership);
        }
      }

      return memberIds.map((memberId) => byMember.get(memberId) ?? []);
    });
  }

  load(memberId: string): Promise<IMembership[]> {
    return this.loader.load(memberId);
  }
}
