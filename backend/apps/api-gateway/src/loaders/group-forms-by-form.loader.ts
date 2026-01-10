import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import type { IGroupForm } from '@app/common';
import { GroupFormService } from '../group-form/group-form.service';

@Injectable({ scope: Scope.REQUEST })
export class GroupFormsByFormLoader {
  private readonly loader: DataLoader<string, IGroupForm[]>;

  constructor(private readonly groupFormService: GroupFormService) {
    this.loader = new DataLoader<string, IGroupForm[]>(async (formIds) => {
      const groupForms = await this.groupFormService.listByForms([...formIds]);
      const byFormId = new Map<string, IGroupForm[]>();

      for (const formId of formIds) {
        byFormId.set(formId, []);
      }

      for (const groupForm of groupForms) {
        const formRelations = byFormId.get(groupForm.formId);
        if (formRelations) {
          formRelations.push(groupForm);
        }
      }

      return formIds.map((formId) => byFormId.get(formId) ?? []);
    });
  }

  load(formId: string): Promise<IGroupForm[]> {
    return this.loader.load(formId);
  }

  loadMany(formIds: readonly string[]) {
    return this.loader.loadMany(formIds);
  }
}
