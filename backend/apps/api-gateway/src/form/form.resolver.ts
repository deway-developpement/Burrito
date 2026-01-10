import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CRUDResolver } from '@nestjs-query/query-graphql';
import { FormDto } from './dto/form.dto';
import { FormService } from './form.service';
import {
  GqlAuthGuard,
  GqlCredentialGuard,
  CurrentUser,
} from '../auth/guards/graphql-auth.guard';
import { CreateFormInput } from './dto/create-form.input';
import { UpdateFormInput } from './dto/update-form.input';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { TimestampToDateInterceptor } from '../interceptor/date.interceptor';
import { UserType } from '../../../../libs/common/src';
import { EvaluationService } from '../evaluation/evaluation.service';
import type { AuthCredentials } from '../../../../libs/common/src/interfaces/auth.type';
import { GroupFormsByFormLoader } from '../loaders/group-forms-by-form.loader';
import { GroupByIdLoader } from '../loaders/group-by-id.loader';
import { GroupDto } from '../group/dto/group.dto';
import { ChangeFormStatusInput } from './dto/change-form-status.input';
import { UserDto } from '../user/dto/user.dto';
import { UserByIdLoader } from '../loaders/user-by-id.loader';

@Resolver(() => FormDto)
@UseInterceptors(TimestampToDateInterceptor)
export class FormResolver extends CRUDResolver(FormDto, {
  CreateDTOClass: CreateFormInput,
  UpdateDTOClass: UpdateFormInput,
  read: { guards: [GqlAuthGuard] },
  create: { guards: [GqlCredentialGuard(UserType.ADMIN)] },
  update: { guards: [GqlCredentialGuard(UserType.ADMIN)] },
  delete: { guards: [GqlCredentialGuard(UserType.ADMIN)] },
  aggregate: {
    enabled: true,
    guards: [GqlCredentialGuard(UserType.ADMIN)],
  },
}) {
  constructor(
    readonly service: FormService,
    private readonly evaluationService: EvaluationService,
    private readonly groupFormsByFormLoader: GroupFormsByFormLoader,
    private readonly groupByIdLoader: GroupByIdLoader,
    private readonly userByIdLoader: UserByIdLoader,
  ) {
    super(service);
  }

  @ResolveField(() => [GroupDto])
  async groups(@Parent() form: FormDto): Promise<GroupDto[]> {
    const groupForms = await this.groupFormsByFormLoader.load(form.id);
    const groupIds = Array.from(
      new Set(groupForms.map((groupForm) => groupForm.groupId)),
    );

    if (groupIds.length === 0) {
      return [];
    }

    const groups = await this.groupByIdLoader.loadMany(groupIds);

    return groups.filter(
      (group): group is GroupDto => Boolean(group) && !(group instanceof Error),
    );
  }

  @ResolveField(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async userRespondedToForm(
    @Parent() form: FormDto,
    @CurrentUser() user: AuthCredentials,
    @Args('userId', { type: () => String, nullable: true }) userId?: string,
  ): Promise<boolean> {
    return this.evaluationService.userRespondedToForm(
      form.id,
      userId || user.id,
    );
  }

  @ResolveField(() => UserDto, { nullable: true })
  async teacher(@Parent() form: FormDto): Promise<UserDto | undefined> {
    if (!form.targetTeacherId) {
      return undefined;
    }
    const teacher = await this.userByIdLoader.load(form.targetTeacherId);
    if (!teacher || teacher instanceof Error) {
      return undefined;
    }
    return teacher;
  }

  @Mutation(() => FormDto)
  @UseGuards(GqlCredentialGuard(UserType.TEACHER))
  async changeFormStatus(
    @Args('input') input: ChangeFormStatusInput,
  ): Promise<FormDto> {
    return this.service.changeStatus(input.id, input.status);
  }
}
