import { Resolver, Mutation, Query, Args, Directive } from '@nestjs/graphql';
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
  delete: { guards: [GqlCredentialGuard(UserType.ADMIN)] },
}) {
  constructor(@Inject(UserService) private readonly userService: UserService) {
    super(userService);
  }

  @Mutation(() => UserDto)
  @Directive('@auth(role: "ADMIN")')
  async createStudent(
    @Args('createUserInput') createUserInput: CreateUserInput,
  ) {
    return this.userService.createOne(createUserInput);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => UserDto)
  async me(@CurrentUser() user: AuthCredentials): Promise<UserDto | undefined> {
    return this.userService.findById(user.id);
  }
}
