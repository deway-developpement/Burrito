import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import type { IGroupForm } from '@app/common';
import { GroupFormService } from '../group-form/group-form.service';

@Injectable({ scope: Scope.REQUEST })
export class GroupFormsByGroupLoader {
  private readonly loader: DataLoader<string, IGroupForm[]>;

  constructor(private readonly groupFormService: GroupFormService) {
    this.loader = new DataLoader<string, IGroupForm[]>(async (groupIds) => {
      const groupForms = await this.groupFormService.listByGroups([
        ...groupIds,
      ]);
      const byGroupId = new Map<string, IGroupForm[]>();

      for (const groupId of groupIds) {
        byGroupId.set(groupId, []);
      }

      for (const groupForm of groupForms) {
        const groupRelations = byGroupId.get(groupForm.groupId);
        if (groupRelations) {
          groupRelations.push(groupForm);
        }
      }

      return groupIds.map((groupId) => byGroupId.get(groupId) ?? []);
    });
  }

  load(groupId: string): Promise<IGroupForm[]> {
    return this.loader.load(groupId);
  }

  loadMany(groupIds: readonly string[]) {
    return this.loader.loadMany(groupIds);
  }
}
