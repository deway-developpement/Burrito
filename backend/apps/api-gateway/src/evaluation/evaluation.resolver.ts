import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CRUDResolver } from '@nestjs-query/query-graphql';
import { EvaluationDto } from './dto/evaluation.dto';
import { EvaluationService } from './evaluation.service';
import { CreateEvaluationInput } from './dto/create-evaluation.input';
import { UpdateEvaluationInput } from './dto/update-evaluation.input';
import {
  CurrentUser,
  GqlAuthGuard,
  GqlCredentialGuard,
} from '../auth/guards/graphql-auth.guard';
import { TimestampToDateInterceptor } from '../interceptor/date.interceptor';
import { UserType } from '@app/common';
import { UseGuards, UseInterceptors } from '@nestjs/common';

@Resolver(() => EvaluationDto)
@UseInterceptors(TimestampToDateInterceptor)
export class EvaluationResolver extends CRUDResolver(EvaluationDto, {
  CreateDTOClass: CreateEvaluationInput,
  UpdateDTOClass: UpdateEvaluationInput,
  read: { guards: [] },
  create: { disabled: true },
  update: {
    guards: [],
  },
  delete: { guards: [GqlCredentialGuard(UserType.ADMIN)] },
  aggregate: {
    enabled: true,
    guards: [GqlCredentialGuard(UserType.ADMIN)],
  },
}) {
  constructor(readonly service: EvaluationService) {
    super(service);
  }

  @Mutation(() => EvaluationDto)
  @UseGuards(GqlAuthGuard)
  async submitEvaluation(
    @CurrentUser() user: { id: string },
    @Args('input') input: CreateEvaluationInput,
  ): Promise<EvaluationDto> {
    return this.service.createOne({ ...input, respondentToken: user.id });
  }
}
