import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UserService } from './user.service';
import { CreateUserInput } from './dto/create-user.input';
import { CRUDResolver } from '@nestjs-query/query-graphql';
import { Inject, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserDto } from './dto/user.dto';
import { CurrentUser, GqlAuthGuard } from '../auth/guards/graphql-auth.guard';
import type { AuthCredentials } from '../../../../libs/common/src/interfaces/auth.type';
import { UserDateInterceptor } from './interceptor/date.interceptor';

@Resolver(() => UserDto)
@UseInterceptors(UserDateInterceptor)
export class UserResolver extends CRUDResolver(UserDto, {
  read: { guards: [GqlAuthGuard] },
  create: { disabled: true },
  update: { disabled: true },
  delete: { disabled: true },
}) {
  constructor(@Inject(UserService) private readonly userService: UserService) {
    super(userService);
  }

  @Mutation(() => UserDto)
  async createUser(@Args('createUserInput') createUserInput: CreateUserInput) {
    return this.userService.createOne(createUserInput);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => UserDto)
  async me(@CurrentUser() user: AuthCredentials): Promise<UserDto | undefined> {
    return this.userService.findById(user.id);
  }
}
