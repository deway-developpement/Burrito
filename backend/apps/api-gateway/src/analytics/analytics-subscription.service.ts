import { Inject, Injectable } from '@nestjs/common';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import type { TextAnalysisStatus } from './dto/analytics-snapshot.dto';

export const ANALYTICS_PUBSUB = 'ANALYTICS_PUBSUB';
export const ANALYTICS_TEXT_ANALYSIS_STATUS_CHANGED_EVENT =
  'analytics.textAnalysisStatusChanged';

export type AnalyticsTextAnalysisStatusEvent = {
  formId: string;
  questionId: string;
  windowKey: string;
  window?: { from?: Date | string; to?: Date | string };
  analysisStatus: TextAnalysisStatus;
  analysisHash?: string;
  analysisError?: string;
  lastEnrichedAt?: Date | string;
  topIdeas?: Array<{ idea: string; count: number }>;
  sentiment?: {
    positivePct: number;
    neutralPct: number;
    negativePct: number;
  };
};

@Injectable()
export class AnalyticsSubscriptionService {
  constructor(
    @Inject(ANALYTICS_PUBSUB) private readonly pubSub: RedisPubSub,
  ) {}

  publishTextAnalysisStatusChanged(
    payload: AnalyticsTextAnalysisStatusEvent,
  ): Promise<void> {
    const normalized = this.normalizePayload(payload);
    return this.pubSub.publish(ANALYTICS_TEXT_ANALYSIS_STATUS_CHANGED_EVENT, {
      analyticsTextAnalysisStatusChanged: normalized,
    });
  }

  getTextAnalysisStatusChangedIterator() {
    return this.pubSub.asyncIterator<{
      analyticsTextAnalysisStatusChanged: AnalyticsTextAnalysisStatusEvent;
    }>(ANALYTICS_TEXT_ANALYSIS_STATUS_CHANGED_EVENT);
  }

  private normalizePayload(
    payload: AnalyticsTextAnalysisStatusEvent,
  ): AnalyticsTextAnalysisStatusEvent {
    return {
      ...payload,
      window: this.normalizeWindow(payload.window),
      lastEnrichedAt: this.normalizeDate(payload.lastEnrichedAt),
    };
  }

  private normalizeWindow(
    window?: AnalyticsTextAnalysisStatusEvent['window'],
  ): AnalyticsTextAnalysisStatusEvent['window'] {
    if (!window) {
      return undefined;
    }
    const from = this.normalizeDate(window.from);
    const to = this.normalizeDate(window.to);
    if (!from && !to) {
      return undefined;
    }
    return { from, to };
  }

  private normalizeDate(value?: Date | string): Date | undefined {
    if (!value) {
      return undefined;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    return date;
  }
}
