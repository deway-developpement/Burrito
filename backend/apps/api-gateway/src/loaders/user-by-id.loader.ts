import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { UserDto } from '../user/dto/user.dto';
import { UserService } from '../user/user.service';

@Injectable({ scope: Scope.REQUEST })
export class UserByIdLoader {
  private readonly loader: DataLoader<string, UserDto | undefined>;

  constructor(private readonly userService: UserService) {
    this.loader = new DataLoader<string, UserDto | undefined>(
      async (userIds) => {
        const users = await this.userService.findByIds([...userIds]);
        const normalizedUsers = users
          .map((user) => {
            const id = user.id ?? (user as { _id?: string })._id;
            if (!id) {
              return undefined;
            }
            return { ...user, id };
          })
          .filter((user): user is UserDto => Boolean(user));
        const byId = new Map(normalizedUsers.map((user) => [user.id, user]));
        return userIds.map((userId) => byId.get(userId));
      },
    );
  }

  load(userId: string): Promise<UserDto | undefined> {
    return this.loader.load(userId);
  }

  loadMany(userIds: readonly string[]) {
    return this.loader.loadMany(userIds);
  }
}
