import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { GroupDto } from '../group/dto/group.dto';
import { GroupService } from '../group/group.service';

@Injectable({ scope: Scope.REQUEST })
export class GroupByIdLoader {
  private readonly loader: DataLoader<string, GroupDto | undefined>;

  constructor(private readonly groupService: GroupService) {
    this.loader = new DataLoader<string, GroupDto | undefined>(
      async (groupIds) => {
        const groups = await this.groupService.findByIds([...groupIds]);
        const normalizedGroups = groups
          .map((group) => {
            const id = group.id ?? (group as { _id?: string })._id;
            if (!id) {
              return undefined;
            }
            return { ...group, id };
          })
          .filter((group): group is GroupDto => Boolean(group));
        const byId = new Map(normalizedGroups.map((group) => [group.id, group]));
        return groupIds.map((groupId) => byId.get(groupId));
      },
    );
  }

  load(groupId: string): Promise<GroupDto | undefined> {
    return this.loader.load(groupId);
  }

  loadMany(groupIds: readonly string[]) {
    return this.loader.loadMany(groupIds);
  }
}
