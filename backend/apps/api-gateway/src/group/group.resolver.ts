import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { UseGuards, UseInterceptors, NotFoundException } from '@nestjs/common';
import { CRUDResolver } from '@nestjs-query/query-graphql';
import { GroupDto } from './dto/group.dto';
import { GroupService } from './group.service';
import { CreateGroupInput } from './dto/create-group.input';
import { UpdateGroupInput } from './dto/update-group.input';
import { AddUserToGroupInput } from './dto/add-user-to-group.input';
import { RemoveUserFromGroupInput } from './dto/remove-user-from-group.input';
import {
  GqlAuthGuard,
  GqlCredentialGuard,
} from '../auth/guards/graphql-auth.guard';
import { TimestampToDateInterceptor } from '../interceptor/date.interceptor';
import { MembershipService } from '../membership/membership.service';
import { UserDto } from '../user/dto/user.dto';
import { UserType } from '@app/common';
import { MembershipsByGroupLoader } from '../loaders/memberships-by-group.loader';
import { UserByIdLoader } from '../loaders/user-by-id.loader';

@Resolver(() => GroupDto)
@UseInterceptors(TimestampToDateInterceptor)
export class GroupResolver extends CRUDResolver(GroupDto, {
  CreateDTOClass: CreateGroupInput,
  UpdateDTOClass: UpdateGroupInput,
  read: { guards: [GqlAuthGuard] },
  create: { guards: [GqlCredentialGuard(UserType.ADMIN)] },
  update: { guards: [GqlCredentialGuard(UserType.ADMIN)] },
  delete: { guards: [GqlCredentialGuard(UserType.ADMIN)] },
}) {
  constructor(
    readonly service: GroupService,
    private readonly membershipService: MembershipService,
    private readonly membershipsByGroupLoader: MembershipsByGroupLoader,
    private readonly userByIdLoader: UserByIdLoader,
  ) {
    super(service);
  }

  @ResolveField(() => [UserDto])
  async members(@Parent() group: GroupDto): Promise<UserDto[]> {
    const memberships = await this.membershipsByGroupLoader.load(group.id);
    const memberIds = Array.from(
      new Set(memberships.map((membership) => membership.memberId)),
    );

    if (memberIds.length === 0) {
      return [];
    }

    const users = await this.userByIdLoader.loadMany(memberIds);

    return users.filter(
      (user): user is UserDto => Boolean(user) && !(user instanceof Error),
    );
  }

  @Mutation(() => GroupDto)
  @UseGuards(GqlCredentialGuard(UserType.ADMIN))
  async addUserToGroup(
    @Args('input') input: AddUserToGroupInput,
  ): Promise<GroupDto> {
    const { groupId, memberId } = input;

    const group = await this.service.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    await this.membershipService.addMember({
      groupId,
      memberId,
    });

    return group;
  }

  @Mutation(() => GroupDto)
  @UseGuards(GqlCredentialGuard(UserType.ADMIN))
  async removeUserFromGroup(
    @Args('input') input: RemoveUserFromGroupInput,
  ): Promise<GroupDto> {
    const { groupId, memberId } = input;

    const group = await this.service.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const removed = await this.membershipService.removeMember({
      groupId,
      memberId,
    });

    if (!removed) {
      throw new NotFoundException('Membership not found');
    }

    return group;
  }
}
