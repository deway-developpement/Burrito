import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import {
  GqlCredentialGuard,
  GqlOrGuard,
} from '../auth/guards/graphql-auth.guard';
import { UserType } from '@app/common';
import {
  AnalyticsSnapshotDto,
  AnalyticsWindowInput,
} from './dto/analytics-snapshot.dto';
import { AnalyticsService } from './analytics.service';

@Resolver(() => AnalyticsSnapshotDto)
export class AnalyticsResolver {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Query(() => AnalyticsSnapshotDto)
  @UseGuards(
    GqlOrGuard(
      GqlCredentialGuard(UserType.TEACHER),
      GqlCredentialGuard(UserType.ADMIN),
    ),
  )
  analyticsSnapshot(
    @Args('formId') formId: string,
    @Args('window', { type: () => AnalyticsWindowInput, nullable: true })
    window?: AnalyticsWindowInput,
    @Args('forceSync', { type: () => Boolean, nullable: true })
    forceSync?: boolean,
  ): Promise<AnalyticsSnapshotDto> {
    return this.analyticsService.getFormSnapshot({
      formId,
      window,
      forceSync,
    });
  }

  @Mutation(() => AnalyticsSnapshotDto)
  @UseGuards(
    GqlOrGuard(
      GqlCredentialGuard(UserType.TEACHER),
      GqlCredentialGuard(UserType.ADMIN),
    ),
  )
  refreshAnalyticsSnapshot(
    @Args('formId') formId: string,
    @Args('window', { type: () => AnalyticsWindowInput, nullable: true })
    window?: AnalyticsWindowInput,
    @Args('forceSync', { type: () => Boolean, nullable: true })
    forceSync?: boolean,
  ): Promise<AnalyticsSnapshotDto> {
    return this.analyticsService.refreshSnapshot({
      formId,
      window,
      forceSync,
    });
  }
}
