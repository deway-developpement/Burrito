import { GatewayTimeoutException, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  Observable,
  TimeoutError,
  catchError,
  firstValueFrom,
  timeout,
} from 'rxjs';
import { MICROSERVICE_TIMEOUT_MS } from '../constants';
import type {
  AnalyticsSnapshotDto,
  AnalyticsWindowInput,
  RatingBucketDto,
  TextAnalysisStatus,
} from './dto/analytics-snapshot.dto';

export type AnalyticsSnapshotRequest = {
  formId: string;
  window?: AnalyticsWindowInput;
  forceSync?: boolean;
};

type AnalyticsWindowRaw = {
  from?: string | Date;
  to?: string | Date;
};

type RatingStatsRaw = {
  avg: number;
  median: number;
  min: number;
  max: number;
  distribution?: Record<string, number>;
  npsBuckets?: {
    promotersCount: number;
    passivesCount: number;
    detractorsCount: number;
    promotersPct: number;
    passivesPct: number;
    detractorsPct: number;
  };
};

type TextStatsRaw = {
  responseCount: number;
  topIdeas: Array<{ idea: string; count: number }>;
  sentiment?: {
    positivePct: number;
    neutralPct: number;
    negativePct: number;
  };
  analysisStatus?: string;
  analysisHash?: string;
  lastEnrichedAt?: string | Date;
  analysisError?: string;
};

type QuestionAnalyticsRaw = {
  questionId: string;
  label: string;
  type: string;
  answeredCount: number;
  rating?: RatingStatsRaw;
  text?: TextStatsRaw;
};

type AnalyticsSnapshotRaw = {
  formId: string;
  window?: AnalyticsWindowRaw;
  generatedAt: string | Date;
  staleAt: string | Date;
  totalResponses: number;
  nps: {
    score: number;
    promotersPct: number;
    passivesPct: number;
    detractorsPct: number;
    promotersCount: number;
    passivesCount: number;
    detractorsCount: number;
  };
  questions: QuestionAnalyticsRaw[];
  timeSeries: Array<{ bucketStart: string | Date; count: number }>;
};

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject('ANALYTICS_SERVICE')
    private readonly analyticsClient: ClientProxy,
  ) {}

  async getFormSnapshot(
    request: AnalyticsSnapshotRequest,
  ): Promise<AnalyticsSnapshotDto> {
    const snapshot = await this.sendWithTimeout(
      this.analyticsClient.send<AnalyticsSnapshotRaw>(
        { cmd: 'analytics.getFormSnapshot' },
        request,
      ),
    );
    return this.normalizeSnapshot(snapshot);
  }

  async refreshSnapshot(
    request: AnalyticsSnapshotRequest,
  ): Promise<AnalyticsSnapshotDto> {
    const snapshot = await this.sendWithTimeout(
      this.analyticsClient.send<AnalyticsSnapshotRaw>(
        { cmd: 'analytics.refreshSnapshot' },
        request,
      ),
    );
    return this.normalizeSnapshot(snapshot);
  }

  private normalizeSnapshot(
    snapshot: AnalyticsSnapshotRaw,
  ): AnalyticsSnapshotDto {
    const window = this.normalizeWindow(snapshot.window);
    const questions = (snapshot.questions || []).map((question) => ({
      questionId: question.questionId,
      label: question.label,
      type: question.type,
      answeredCount: question.answeredCount,
      rating: question.rating
        ? {
            avg: question.rating.avg,
            median: question.rating.median,
            min: question.rating.min,
            max: question.rating.max,
            distribution: this.normalizeDistribution(
              question.rating.distribution || {},
            ),
            npsBuckets: question.rating.npsBuckets || {
              promotersCount: 0,
              passivesCount: 0,
              detractorsCount: 0,
              promotersPct: 0,
              passivesPct: 0,
              detractorsPct: 0,
            },
          }
        : undefined,
      text: question.text
        ? {
            responseCount: question.text.responseCount,
            topIdeas: question.text.topIdeas || [],
            sentiment: question.text.sentiment,
            analysisStatus: this.normalizeStatus(question.text.analysisStatus),
            analysisHash: question.text.analysisHash,
            lastEnrichedAt: this.toDate(question.text.lastEnrichedAt),
            analysisError: question.text.analysisError,
          }
        : undefined,
    }));

    const timeSeries = (snapshot.timeSeries || []).map((bucket) => ({
      bucketStart: this.toDate(bucket.bucketStart),
      count: bucket.count,
    }));

    return {
      formId: snapshot.formId,
      window,
      generatedAt: this.toDate(snapshot.generatedAt),
      staleAt: this.toDate(snapshot.staleAt),
      totalResponses: snapshot.totalResponses,
      nps: snapshot.nps,
      questions,
      timeSeries,
    } as AnalyticsSnapshotDto;
  }

  private normalizeDistribution(
    distribution: Record<string, number>,
  ): RatingBucketDto[] {
    return Object.entries(distribution)
      .map(([rating, count]) => ({
        rating: Number.parseInt(rating, 10),
        count,
      }))
      .filter((bucket) => Number.isFinite(bucket.rating))
      .sort((a, b) => a.rating - b.rating);
  }

  private normalizeWindow(window?: AnalyticsWindowRaw) {
    if (!window) {
      return undefined;
    }
    const from = this.toDate(window.from);
    const to = this.toDate(window.to);
    if (!from && !to) {
      return undefined;
    }
    return { from, to };
  }

  private normalizeStatus(value?: string): TextAnalysisStatus | undefined {
    if (!value) {
      return undefined;
    }
    const normalized = value.toUpperCase();
    const allowed = ['PENDING', 'READY', 'DISABLED', 'FAILED'];
    if (allowed.includes(normalized)) {
      return normalized as TextAnalysisStatus;
    }
    return 'FAILED' as TextAnalysisStatus;
  }

  private toDate(value: string | Date | undefined): Date | undefined {
    if (!value) {
      return undefined;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    return date;
  }

  private async sendWithTimeout<T>(observable: Observable<T>): Promise<T> {
    return firstValueFrom(
      observable.pipe(
        timeout(MICROSERVICE_TIMEOUT_MS),
        catchError((err) => {
          if (err instanceof TimeoutError) {
            throw new GatewayTimeoutException('Analytics service timed out');
          }
          if (err instanceof Error) {
            throw err;
          }
          const message =
            typeof err === 'string'
              ? err
              : err && typeof err === 'object' && 'message' in err
                ? String((err as { message?: unknown }).message)
                : 'Analytics service error';
          throw new Error(message);
        }),
      ),
    );
  }
}
