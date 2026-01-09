import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
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

@Resolver(() => FormDto)
@UseInterceptors(TimestampToDateInterceptor)
export class FormResolver extends CRUDResolver(FormDto, {
  CreateDTOClass: CreateFormInput,
  UpdateDTOClass: UpdateFormInput,
  read: { guards: [GqlAuthGuard] },
  create: { guards: [GqlCredentialGuard(UserType.TEACHER)] },
  update: { guards: [GqlCredentialGuard(UserType.TEACHER)] },
  delete: { guards: [GqlCredentialGuard(UserType.TEACHER)] },
}) {
  constructor(
    readonly service: FormService,
    private readonly evaluationService: EvaluationService,
  ) {
    super(service);
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
}
