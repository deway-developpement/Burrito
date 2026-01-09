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
import { AddFormToGroupInput } from './dto/add-form-to-group.input';
import { RemoveFormFromGroupInput } from './dto/remove-form-from-group.input';
import {
  GqlAuthGuard,
  GqlCredentialGuard,
} from '../auth/guards/graphql-auth.guard';
import { TimestampToDateInterceptor } from '../interceptor/date.interceptor';
import { MembershipService } from '../membership/membership.service';
import { UserDto } from '../user/dto/user.dto';
import { FormDto } from '../form/dto/form.dto';
import { UserType } from '@app/common';
import { MembershipsByGroupLoader } from '../loaders/memberships-by-group.loader';
import { UserByIdLoader } from '../loaders/user-by-id.loader';
import { GroupFormService } from '../group-form/group-form.service';
import { GroupFormsByGroupLoader } from '../loaders/group-forms-by-group.loader';
import { FormByIdLoader } from '../loaders/form-by-id.loader';

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
    private readonly groupFormService: GroupFormService,
    private readonly groupFormsByGroupLoader: GroupFormsByGroupLoader,
    private readonly formByIdLoader: FormByIdLoader,
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

  @ResolveField(() => [FormDto])
  async forms(@Parent() group: GroupDto): Promise<FormDto[]> {
    const groupForms = await this.groupFormsByGroupLoader.load(group.id);
    const formIds = Array.from(
      new Set(groupForms.map((groupForm) => groupForm.formId)),
    );

    if (formIds.length === 0) {
      return [];
    }

    const forms = await this.formByIdLoader.loadMany(formIds);

    return forms.filter(
      (form): form is FormDto => Boolean(form) && !(form instanceof Error),
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

  @Mutation(() => GroupDto)
  @UseGuards(GqlCredentialGuard(UserType.ADMIN))
  async addFormToGroup(
    @Args('input') input: AddFormToGroupInput,
  ): Promise<GroupDto> {
    const { groupId, formId } = input;

    const group = await this.service.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    await this.groupFormService.addForm({
      groupId,
      formId,
    });

    return group;
  }

  @Mutation(() => GroupDto)
  @UseGuards(GqlCredentialGuard(UserType.ADMIN))
  async removeFormFromGroup(
    @Args('input') input: RemoveFormFromGroupInput,
  ): Promise<GroupDto> {
    const { groupId, formId } = input;

    const group = await this.service.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const removed = await this.groupFormService.removeForm({
      groupId,
      formId,
    });

    if (!removed) {
      throw new NotFoundException('Group form not found');
    }

    return group;
  }
}
