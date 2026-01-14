import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import {
  GqlCredentialGuard,
  GqlOrGuard,
} from '../auth/guards/graphql-auth.guard';
import { UserType } from '@app/common';
import {
  AnalyticsSnapshotDto,
  AnalyticsTextAnalysisUpdateDto,
  AnalyticsWindowInput,
} from './dto/analytics-snapshot.dto';
import { AnalyticsService } from './analytics.service';
import { AnalyticsSubscriptionService } from './analytics-subscription.service';

const normalizeDate = (value?: Date | string): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date;
};

const normalizeWindow = (window?: {
  from?: Date | string;
  to?: Date | string;
}) => {
  if (!window) {
    return undefined;
  }
  const from = normalizeDate(window.from);
  const to = normalizeDate(window.to);
  if (!from && !to) {
    return undefined;
  }
  return { from, to };
};

const computeWindowKey = (window?: AnalyticsWindowInput): string => {
  const normalized = normalizeWindow(window);
  if (!normalized?.from && !normalized?.to) {
    return 'all-time';
  }
  const from = normalized?.from ? normalized.from.toISOString() : 'start';
  const to = normalized?.to ? normalized.to.toISOString() : 'end';
  return `${from}|${to}`;
};

const normalizeSubscriptionPayload = (
  update: AnalyticsTextAnalysisUpdateDto,
): AnalyticsTextAnalysisUpdateDto => ({
  ...update,
  window: normalizeWindow(update.window),
  lastEnrichedAt: normalizeDate(update.lastEnrichedAt),
});

@Resolver(() => AnalyticsSnapshotDto)
export class AnalyticsResolver {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly analyticsSubscriptionService: AnalyticsSubscriptionService,
  ) {}

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

  @Subscription(() => AnalyticsTextAnalysisUpdateDto, {
    filter: (payload, variables) => {
      const update = payload.analyticsTextAnalysisStatusChanged;
      if (!update) {
        return false;
      }
      if (update.formId !== variables.formId) {
        return false;
      }
      const requestedWindowKey = computeWindowKey(variables.window);
      return update.windowKey === requestedWindowKey;
    },
    resolve: (payload) =>
      normalizeSubscriptionPayload(payload.analyticsTextAnalysisStatusChanged),
  })
  @UseGuards(
    GqlOrGuard(
      GqlCredentialGuard(UserType.TEACHER),
      GqlCredentialGuard(UserType.ADMIN),
    ),
  )
  analyticsTextAnalysisStatusChanged(
    @Args('formId') formId: string,
    @Args('window', { type: () => AnalyticsWindowInput, nullable: true })
    window?: AnalyticsWindowInput,
  ) {
    return this.analyticsSubscriptionService.getTextAnalysisStatusChangedIterator();
  }
}
