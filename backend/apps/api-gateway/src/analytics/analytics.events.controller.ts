import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import {
  ANALYTICS_TEXT_ANALYSIS_STATUS_CHANGED_EVENT,
  AnalyticsSubscriptionService,
} from './analytics-subscription.service';
import type { AnalyticsTextAnalysisStatusEvent } from './analytics-subscription.service';

@Controller()
export class AnalyticsEventsController {
  constructor(
    private readonly analyticsSubscriptionService: AnalyticsSubscriptionService,
  ) {}

  @EventPattern(ANALYTICS_TEXT_ANALYSIS_STATUS_CHANGED_EVENT)
  async handleTextAnalysisStatusChanged(
    payload: AnalyticsTextAnalysisStatusEvent,
  ): Promise<void> {
    await this.analyticsSubscriptionService.publishTextAnalysisStatusChanged(
      payload,
    );
  }
}
