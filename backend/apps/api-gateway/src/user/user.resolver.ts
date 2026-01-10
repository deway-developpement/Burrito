import {
  Resolver,
  Query,
  Directive,
  ResolveField,
  Parent,
  Mutation,
  Args,
} from '@nestjs/graphql';
import { UserService } from './user.service';
import { CreateUserInput } from './dto/create-user.input';
import { CRUDResolver } from '@nestjs-query/query-graphql';
import { Inject, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserDto } from './dto/user.dto';
import {
  CurrentUser,
  GqlAuthGuard,
  GqlCredentialGuard,
  GqlCurrentUserGuard,
  GqlOrGuard,
} from '../auth/guards/graphql-auth.guard';
import type { AuthCredentials } from '../../../../libs/common/src/interfaces/auth.type';
import { TimestampToDateInterceptor } from '../interceptor/date.interceptor';
import { UserType } from '../../../../libs/common/src';
import { UpdateUserInput } from './dto/update-user.input';
import { GroupDto } from '../group/dto/group.dto';
import { MembershipsByMemberLoader } from '../loaders/memberships-by-member.loader';
import { GroupByIdLoader } from '../loaders/group-by-id.loader';
import { VerifyEmailInput } from './dto/verify-email.input';

@Resolver(() => UserDto)
@Directive('@auth(role: "ADMIN")')
@UseInterceptors(TimestampToDateInterceptor)
export class UserResolver extends CRUDResolver(UserDto, {
  UpdateDTOClass: UpdateUserInput,
  CreateDTOClass: CreateUserInput,
  read: { guards: [GqlAuthGuard] },
  create: { guards: [GqlCredentialGuard(UserType.ADMIN)] },
  update: {
    guards: [
      GqlOrGuard(new GqlCurrentUserGuard(), GqlCredentialGuard(UserType.ADMIN)),
    ],
  },
  delete: {
    guards: [
      GqlOrGuard(new GqlCurrentUserGuard(), GqlCredentialGuard(UserType.ADMIN)),
    ],
  },
}) {
  constructor(
    @Inject(UserService) private readonly userService: UserService,
    private readonly membershipsByMemberLoader: MembershipsByMemberLoader,
    private readonly groupByIdLoader: GroupByIdLoader,
  ) {
    super(userService);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => UserDto)
  async me(@CurrentUser() user: AuthCredentials): Promise<UserDto | undefined> {
    return this.userService.findById(user.id);
  }

  @ResolveField(() => [GroupDto])
  async groups(@Parent() user: UserDto): Promise<GroupDto[]> {
    const memberships = await this.membershipsByMemberLoader.load(user.id);
    const groupIds = Array.from(
      new Set(memberships.map((membership) => membership.groupId)),
    );

    if (groupIds.length === 0) {
      return [];
    }

    const groups = await this.groupByIdLoader.loadMany(groupIds);
    return groups.filter(
      (group): group is GroupDto => !(group instanceof Error) && Boolean(group),
    );
  }

  @Mutation(() => UserDto)
  async verifyEmail(@Args('input') input: VerifyEmailInput): Promise<UserDto> {
    return this.userService.verifyEmail(input.token);
  }

  @Mutation(() => UserDto)
  @UseGuards(GqlAuthGuard)
  async resendEmailVerification(
    @CurrentUser() user: AuthCredentials,
  ): Promise<UserDto> {
    return this.userService.resendVerification(user.id);
  }
}
