import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { createHash, randomUUID } from 'crypto';
import {
  AnalyticsSnapshot,
  NpsBuckets,
  NpsSummary,
  QuestionAnalytics,
  RatingStats,
  TextStats,
} from './entities/analytics-snapshot.entity';
import type {
  AnalyticsWindow,
  GetFormSnapshotRequest,
} from './analytics.controller';
import { IntelligenceStreamClient } from './intelligence-stream.client';
import type {
  IntelligenceRequestEvent,
  IntelligenceResultEvent,
} from './intelligence-stream.types';

type QuestionType = 'RATING' | 'TEXT';

type FormQuestion = {
  id?: string;
  _id?: string;
  label: string;
  type: QuestionType;
};

type FormRecord = {
  id?: string;
  _id?: string;
  title: string;
  questions: FormQuestion[];
};

type EvaluationAnswer = {
  questionId: string;
  rating?: number;
  text?: string;
};

type EvaluationRecord = {
  answers: EvaluationAnswer[];
  createdAt?: Date | string;
};

type SnapshotOptions = {
  forceRefresh: boolean;
};

type AnalyticsSnapshotLean = {
  _id: Types.ObjectId | string;
  formId: string;
  windowKey: string;
  window?: { from?: Date; to?: Date };
  generatedAt: Date;
  staleAt: Date;
  totalResponses: number;
  nps: NpsSummary;
  questions: QuestionAnalytics[];
  timeSeries: Array<{ bucketStart: Date; count: number }>;
};

type AnalyticsSnapshotPayload = Omit<AnalyticsSnapshotLean, '_id'>;

type TextInput = {
  questionId: string;
  questionText: string;
  answers: string[];
  hash: string;
};

type SnapshotTextUpdate = {
  $set: Record<string, unknown>;
  $unset?: Record<string, unknown>;
};

const TEXT_ANALYSIS_STATUS = {
  pending: 'PENDING',
  ready: 'READY',
  disabled: 'DISABLED',
  failed: 'FAILED',
} as const;

type TextAnalysisStatus =
  (typeof TEXT_ANALYSIS_STATUS)[keyof typeof TEXT_ANALYSIS_STATUS];

type TextAnalysisStatusChangedEvent = {
  formId: string;
  questionId: string;
  windowKey: string;
  window?: AnalyticsWindow;
  analysisStatus: TextAnalysisStatus;
  analysisHash?: string;
  analysisError?: string;
  lastEnrichedAt?: Date;
  topIdeas?: Array<{ idea: string; count: number }>;
  sentiment?: {
    positivePct: number;
    neutralPct: number;
    negativePct: number;
  };
};

const ANALYTICS_TEXT_ANALYSIS_STATUS_CHANGED_EVENT =
  'analytics.textAnalysisStatusChanged';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly pageSize = Math.max(
    1,
    parseInt(process.env.ANALYTICS_PAGE_SIZE || '1000'),
  );
  private readonly snapshotTtlSeconds = Math.max(
    60,
    parseInt(process.env.ANALYTICS_SNAPSHOT_TTL_SECONDS || '3600'),
  );
  private readonly timeBucket =
    (process.env.ANALYTICS_TIME_BUCKET || 'day').toLowerCase() === 'week'
      ? 'week'
      : 'day';
  private readonly enableIntelligence =
    (process.env.ANALYTICS_ENABLE_INTELLIGENCE || 'false').toLowerCase() ===
    'true';
  private readonly intelligencePendingTimeoutMs = Math.max(
    1000,
    parseInt(
      process.env.ANALYTICS_INTELLIGENCE_PENDING_TIMEOUT_MS ||
        process.env.ANALYTICS_INTELLIGENCE_TIMEOUT_MS ||
        '300000',
    ),
  );

  private readonly inFlightEnrichments = new Set<string>();

  constructor(
    @InjectModel(AnalyticsSnapshot.name)
    private readonly snapshotModel: Model<AnalyticsSnapshot>,
    @Inject('FORM_SERVICE') private readonly formClient: ClientProxy,
    @Inject('EVALUATION_SERVICE')
    private readonly evaluationClient: ClientProxy,
    @Inject('ANALYTICS_EVENTS')
    private readonly analyticsEventsClient: ClientProxy,
    private readonly streamClient: IntelligenceStreamClient,
  ) {}

  async getFormSnapshot(
    data: GetFormSnapshotRequest,
    options: SnapshotOptions,
  ): Promise<AnalyticsSnapshotLean> {
    if (!data?.formId) {
      throw new RpcException({ status: 400, message: 'formId is required' });
    }

    if (this.enableIntelligence) {
      void this.failTimedOutPendingSnapshots();
    }

    const window = this.normalizeWindow(data.window);
    const windowKey = this.getWindowKey(window);
    const now = new Date();

    if (!options.forceRefresh) {
      const cached = await this.snapshotModel
        .findOne({ formId: data.formId, windowKey })
        .lean<AnalyticsSnapshotLean>()
        .exec();
      if (cached && cached.staleAt && new Date(cached.staleAt) > now) {
        return cached;
      }
    }

    const form = await this.fetchForm(data.formId);
    const evaluations = await this.fetchEvaluations(data.formId, window);
    const { snapshot, textInputs } = this.buildSnapshot(
      form,
      evaluations,
      window,
      windowKey,
      now,
      data.formId,
    );

    const saved = await this.snapshotModel
      .findOneAndUpdate(
        { formId: data.formId, windowKey },
        { $set: snapshot },
        { upsert: true, new: true },
      )
      .lean<AnalyticsSnapshotLean>()
      .exec();
    if (!saved) {
      throw new RpcException({
        status: 500,
        message: 'Failed to save analytics snapshot',
      });
    }

    if (this.enableIntelligence && textInputs.length > 0 && saved) {
      void this.enqueueIntelligenceRequests(saved, textInputs);
    }

    return saved;
  }

  private async fetchForm(formId: string): Promise<FormRecord> {
    let form: FormRecord | null = null;
    try {
      form = await firstValueFrom(
        this.formClient.send<FormRecord>({ cmd: 'form.getById' }, formId),
      );
    } catch (error) {
      this.logger.error(`Forms service error: ${this.describeError(error)}`);
      throw this.wrapUpstreamError('forms', error);
    }

    if (!form) {
      throw new RpcException({ status: 404, message: 'Form not found' });
    }

    return form;
  }

  private async fetchEvaluations(
    formId: string,
    window?: AnalyticsWindow,
  ): Promise<EvaluationRecord[]> {
    const filter: Record<string, unknown> = { formId: { eq: formId } };

    if (window?.from || window?.to) {
      const createdAtFilters: Record<string, unknown>[] = [];
      if (window.from) {
        createdAtFilters.push({ createdAt: { gte: window.from as Date } });
      }
      if (window.to) {
        createdAtFilters.push({ createdAt: { lte: window.to as Date } });
      }
      filter.and = createdAtFilters;
    }

    const all: EvaluationRecord[] = [];
    let offset = 0;

    while (true) {
      let batch: EvaluationRecord[] = [];
      try {
        batch = await firstValueFrom(
          this.evaluationClient.send<EvaluationRecord[]>(
            { cmd: 'evaluation.query' },
            {
              filter,
              paging: { limit: this.pageSize, offset },
            },
          ),
        );
      } catch (error) {
        this.logger.error(
          `Evaluations service error: ${this.describeError(error)}`,
        );
        throw this.wrapUpstreamError('evaluations', error);
      }

      if (!Array.isArray(batch) || batch.length === 0) {
        break;
      }

      all.push(...batch);
      if (batch.length < this.pageSize) {
        break;
      }
      offset += this.pageSize;
    }

    return all;
  }

  private buildSnapshot(
    form: FormRecord,
    evaluations: EvaluationRecord[],
    window: AnalyticsWindow | undefined,
    windowKey: string,
    now: Date,
    formId: string,
  ): { snapshot: AnalyticsSnapshotPayload; textInputs: TextInput[] } {
    const questions = Array.isArray(form.questions) ? form.questions : [];
    const questionMeta = new Map<string, FormQuestion>();
    for (const question of questions) {
      const id = (question.id || question._id || '').toString();
      if (id) {
        questionMeta.set(id, question);
      }
    }

    const questionAccumulators = new Map<
      string,
      {
        answeredCount: number;
        ratings: number[];
        distribution: Record<number, number>;
        npsCounts: { promoters: number; passives: number; detractors: number };
        textAnswers: string[];
      }
    >();

    for (const [questionId] of questionMeta) {
      questionAccumulators.set(questionId, {
        answeredCount: 0,
        ratings: [],
        distribution: this.buildEmptyDistribution(),
        npsCounts: { promoters: 0, passives: 0, detractors: 0 },
        textAnswers: [],
      });
    }

    const overallNpsCounts = { promoters: 0, passives: 0, detractors: 0 };

    const timeSeriesCounts = new Map<string, number>();

    for (const evaluation of evaluations) {
      const createdAt = this.toDate(evaluation.createdAt);
      if (createdAt) {
        const bucketStart = this.getBucketStart(createdAt);
        const key = bucketStart.toISOString();
        timeSeriesCounts.set(key, (timeSeriesCounts.get(key) || 0) + 1);
      }

      const answers = Array.isArray(evaluation.answers)
        ? evaluation.answers
        : [];
      for (const answer of answers) {
        const accumulator = questionAccumulators.get(answer.questionId);
        if (!accumulator) {
          continue;
        }

        const meta = questionMeta.get(answer.questionId);
        if (!meta) {
          continue;
        }

        if (meta.type === 'RATING') {
          const ratingValue = this.toNumber(answer.rating);
          if (ratingValue && ratingValue >= 1 && ratingValue <= 10) {
            accumulator.ratings.push(ratingValue);
            accumulator.distribution[ratingValue] =
              (accumulator.distribution[ratingValue] || 0) + 1;
            accumulator.answeredCount += 1;
            this.incrementNpsCounts(accumulator.npsCounts, ratingValue);
            this.incrementNpsCounts(overallNpsCounts, ratingValue);
          }
        }

        if (meta.type === 'TEXT') {
          const text =
            typeof answer.text === 'string' ? answer.text.trim() : '';
          if (text) {
            accumulator.textAnswers.push(text);
            accumulator.answeredCount += 1;
          }
        }
      }
    }

    const questionSummaries: QuestionAnalytics[] = [];
    const textInputs: TextInput[] = [];

    for (const question of questions) {
      const questionId = (question.id || question._id || '').toString();
      if (!questionId) {
        continue;
      }

      const accumulator = questionAccumulators.get(questionId);
      if (!accumulator) {
        continue;
      }

      const base: QuestionAnalytics = {
        questionId,
        label: question.label,
        type: question.type,
        answeredCount: accumulator.answeredCount,
      };

      if (question.type === 'RATING') {
        const ratingStats = this.buildRatingStats(accumulator);
        base.rating = ratingStats;
      }

      if (question.type === 'TEXT') {
        const textStats = this.buildTextStats(
          accumulator.textAnswers,
          questionId,
          question.label,
          textInputs,
        );
        base.text = textStats;
      }

      questionSummaries.push(base);
    }

    const timeSeries = Array.from(timeSeriesCounts.entries())
      .map(([key, count]) => ({ bucketStart: new Date(key), count }))
      .sort((a, b) => a.bucketStart.getTime() - b.bucketStart.getTime());

    const npsSummary = this.buildNpsSummary(overallNpsCounts);

    const snapshot: AnalyticsSnapshotPayload = {
      formId,
      windowKey,
      window,
      generatedAt: now,
      staleAt: new Date(now.getTime() + this.snapshotTtlSeconds * 1000),
      totalResponses: evaluations.length,
      nps: npsSummary,
      questions: questionSummaries,
      timeSeries,
    } as AnalyticsSnapshotPayload;

    return { snapshot, textInputs };
  }

  private wrapUpstreamError(service: string, error: unknown): RpcException {
    const message = this.describeError(error) || `${service} service error`;
    const status =
      typeof error === 'object' && error && 'status' in error
        ? (error as { status?: number }).status || 502
        : 502;
    return new RpcException({ status, message });
  }

  isIntelligenceEnabled(): boolean {
    return this.enableIntelligence;
  }

  describeError(error: unknown): string {
    if (!error) {
      return 'Unknown error';
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }

  private buildTextStats(
    textAnswers: string[],
    questionId: string,
    questionLabel: string,
    textInputs: TextInput[],
  ): TextStats {
    const responseCount = textAnswers.length;
    const hasResponses = responseCount > 0;

    let analysisStatus: TextAnalysisStatus = this.enableIntelligence
      ? TEXT_ANALYSIS_STATUS.pending
      : TEXT_ANALYSIS_STATUS.disabled;

    if (!hasResponses) {
      analysisStatus = this.enableIntelligence
        ? TEXT_ANALYSIS_STATUS.ready
        : TEXT_ANALYSIS_STATUS.disabled;
    }

    let analysisHash: string | undefined;
    if (hasResponses) {
      analysisHash = this.hashTextInputs(questionId, textAnswers);
      if (this.enableIntelligence) {
        textInputs.push({
          questionId,
          questionText: questionLabel,
          answers: textAnswers,
          hash: analysisHash,
        });
      }
    }

    return {
      responseCount,
      topIdeas: [],
      analysisStatus,
      analysisHash,
    };
  }

  private buildRatingStats(accumulator: {
    ratings: number[];
    distribution: Record<number, number>;
    npsCounts: { promoters: number; passives: number; detractors: number };
  }): RatingStats {
    const ratings = accumulator.ratings;
    const count = ratings.length;
    const avg = count > 0 ? ratings.reduce((sum, v) => sum + v, 0) / count : 0;
    const sorted = [...ratings].sort((a, b) => a - b);
    const median =
      count === 0
        ? 0
        : count % 2 === 1
          ? sorted[Math.floor(count / 2)]
          : (sorted[count / 2 - 1] + sorted[count / 2]) / 2;

    const min = count > 0 ? sorted[0] : 0;
    const max = count > 0 ? sorted[sorted.length - 1] : 0;

    return {
      avg,
      median,
      min,
      max,
      distribution: accumulator.distribution,
      npsBuckets: this.buildNpsBuckets(accumulator.npsCounts),
    } as RatingStats;
  }

  private buildNpsBuckets(counts: {
    promoters: number;
    passives: number;
    detractors: number;
  }): NpsBuckets {
    const total = counts.promoters + counts.passives + counts.detractors;
    const promotersPct = total > 0 ? (counts.promoters / total) * 100 : 0;
    const passivesPct = total > 0 ? (counts.passives / total) * 100 : 0;
    const detractorsPct = total > 0 ? (counts.detractors / total) * 100 : 0;

    return {
      promotersCount: counts.promoters,
      passivesCount: counts.passives,
      detractorsCount: counts.detractors,
      promotersPct,
      passivesPct,
      detractorsPct,
    } as NpsBuckets;
  }

  private buildNpsSummary(counts: {
    promoters: number;
    passives: number;
    detractors: number;
  }): NpsSummary {
    const total = counts.promoters + counts.passives + counts.detractors;
    const promotersPct = total > 0 ? (counts.promoters / total) * 100 : 0;
    const passivesPct = total > 0 ? (counts.passives / total) * 100 : 0;
    const detractorsPct = total > 0 ? (counts.detractors / total) * 100 : 0;
    const score = promotersPct - detractorsPct;

    return {
      score,
      promotersPct,
      passivesPct,
      detractorsPct,
      promotersCount: counts.promoters,
      passivesCount: counts.passives,
      detractorsCount: counts.detractors,
    } as NpsSummary;
  }

  private buildEmptyDistribution(): Record<number, number> {
    const distribution: Record<number, number> = {};
    for (let rating = 1; rating <= 10; rating += 1) {
      distribution[rating] = 0;
    }
    return distribution;
  }

  private incrementNpsCounts(
    counts: { promoters: number; passives: number; detractors: number },
    rating: number,
  ) {
    if (rating >= 9) {
      counts.promoters += 1;
    } else if (rating >= 7) {
      counts.passives += 1;
    } else {
      counts.detractors += 1;
    }
  }

  private toNumber(value: number | undefined): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    return undefined;
  }

  private toDate(value: Date | string | undefined): Date | undefined {
    if (!value) {
      return undefined;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    return date;
  }

  private getBucketStart(date: Date): Date {
    const bucket = new Date(date.getTime());
    if (this.timeBucket === 'week') {
      const day = bucket.getUTCDay();
      const diff = (day + 6) % 7;
      bucket.setUTCDate(bucket.getUTCDate() - diff);
    }
    bucket.setUTCHours(0, 0, 0, 0);
    return bucket;
  }

  private normalizeWindow(
    window?: AnalyticsWindow,
  ): AnalyticsWindow | undefined {
    if (!window) {
      return undefined;
    }

    const from = window.from ? this.toDate(window.from) : undefined;
    const to = window.to ? this.toDate(window.to) : undefined;

    if (!from && !to) {
      return undefined;
    }

    return { from, to };
  }

  private getWindowKey(window?: AnalyticsWindow): string {
    if (!window?.from && !window?.to) {
      return 'all-time';
    }

    const from = window?.from ? new Date(window.from).toISOString() : 'start';
    const to = window?.to ? new Date(window.to).toISOString() : 'end';
    return `${from}|${to}`;
  }

  private hashTextInputs(questionId: string, answers: string[]): string {
    return createHash('sha256')
      .update(questionId)
      .update('\n')
      .update(answers.join('\n'))
      .digest('hex');
  }

  private emitTextAnalysisStatusChanged(
    payload: TextAnalysisStatusChangedEvent,
  ) {
    void firstValueFrom(
      this.analyticsEventsClient.emit(
        ANALYTICS_TEXT_ANALYSIS_STATUS_CHANGED_EVENT,
        payload,
      ),
    ).catch((error) => {
      this.logger.warn(
        `Failed to emit analytics.textAnalysisStatusChanged: ${this.describeError(error)}`,
      );
    });
  }

  private async enqueueIntelligenceRequests(
    snapshot: AnalyticsSnapshotLean,
    textInputs: TextInput[],
  ): Promise<void> {
    await this.markEnrichmentPending(snapshot, textInputs);

    for (const input of textInputs) {
      const enrichmentKey = `${snapshot._id}:${input.questionId}:${input.hash}`;
      if (this.inFlightEnrichments.has(enrichmentKey)) {
        continue;
      }

      this.inFlightEnrichments.add(enrichmentKey);
      try {
        const requestPayload: IntelligenceRequestEvent = {
          jobId: randomUUID(),
          formId: snapshot.formId,
          snapshotId: String(snapshot._id),
          windowKey: snapshot.windowKey,
          questionId: input.questionId,
          questionText: input.questionText,
          answers: input.answers,
          analysisHash: input.hash,
          createdAt: new Date().toISOString(),
        };

        await this.streamClient.publishRequest(requestPayload);
      } catch (error) {
        const errorMessage = this.describeError(error);
        this.logger.warn(
          `Failed to enqueue intelligence request for question ${input.questionId}: ${errorMessage}`,
        );
        await this.markTextEnrichmentFailed(snapshot, input, errorMessage).catch(
          (updateError) => {
            this.logger.warn(
              `Failed to update analysis status for question ${input.questionId}: ${this.describeError(updateError)}`,
            );
          },
        );
        this.inFlightEnrichments.delete(enrichmentKey);
      }
    }
  }

  async applyIntelligenceResult(payload: IntelligenceResultEvent): Promise<void> {
    if (!this.enableIntelligence) {
      return;
    }

    if (
      !payload?.snapshotId ||
      !payload.formId ||
      !payload.windowKey ||
      !payload.questionId ||
      !payload.analysisHash
    ) {
      throw new Error('Intelligence result payload is missing required fields');
    }

    const snapshot = await this.snapshotModel
      .findById(payload.snapshotId)
      .lean<AnalyticsSnapshotLean>()
      .exec();
    if (!snapshot) {
      return;
    }

    if (
      snapshot.formId !== payload.formId ||
      snapshot.windowKey !== payload.windowKey
    ) {
      return;
    }

    const question = snapshot.questions.find(
      (item) => item.questionId === payload.questionId,
    );
    if (!question?.text) {
      return;
    }

    if (question.text.analysisHash !== payload.analysisHash) {
      return;
    }

    const enrichmentKey = `${snapshot._id}:${payload.questionId}:${payload.analysisHash}`;
    this.inFlightEnrichments.delete(enrichmentKey);

    if (question.text.analysisStatus !== TEXT_ANALYSIS_STATUS.pending) {
      return;
    }

    if (!payload.success) {
      await this.markTextEnrichmentFailedByFields(
        snapshot,
        payload.questionId,
        payload.analysisHash,
        payload.analysisError || 'Unknown intelligence processing error',
      );
      return;
    }

    const topIdeas = (payload.topIdeas || [])
      .filter((item) => typeof item?.idea === 'string' && item.idea.trim())
      .slice(0, 10)
      .map((item) => ({
        idea: item.idea.trim(),
        count: Math.max(1, item.count || 0),
      }));

    const sentiment = payload.sentiment
      ? {
          positivePct: Number(payload.sentiment.positivePct || 0),
          neutralPct: Number(payload.sentiment.neutralPct || 0),
          negativePct: Number(payload.sentiment.negativePct || 0),
        }
      : undefined;

    const lastEnrichedAt = this.toDate(payload.lastEnrichedAt) || new Date();
    const update: SnapshotTextUpdate = {
      $set: {
        'questions.$.text.topIdeas': topIdeas,
        'questions.$.text.sentiment': sentiment,
        'questions.$.text.analysisStatus': TEXT_ANALYSIS_STATUS.ready,
        'questions.$.text.analysisHash': payload.analysisHash,
        'questions.$.text.lastEnrichedAt': lastEnrichedAt,
      },
      $unset: { 'questions.$.text.analysisError': '' },
    };

    const updateResult = await this.snapshotModel.updateOne(
      {
        _id: snapshot._id,
        questions: {
          $elemMatch: {
            questionId: payload.questionId,
            'text.analysisHash': payload.analysisHash,
            'text.analysisStatus': TEXT_ANALYSIS_STATUS.pending,
          },
        },
      },
      update,
    );
    if (!updateResult.modifiedCount) {
      return;
    }

    this.emitTextAnalysisStatusChanged({
      formId: snapshot.formId,
      questionId: payload.questionId,
      windowKey: snapshot.windowKey,
      window: snapshot.window,
      analysisStatus: TEXT_ANALYSIS_STATUS.ready,
      analysisHash: payload.analysisHash,
      lastEnrichedAt,
      topIdeas,
      sentiment,
    });
  }

  async failTimedOutPendingSnapshots(): Promise<void> {
    if (!this.enableIntelligence) {
      return;
    }

    const cutoff = new Date(Date.now() - this.intelligencePendingTimeoutMs);
    const snapshots = await this.snapshotModel
      .find({
        generatedAt: { $lte: cutoff },
        questions: {
          $elemMatch: { 'text.analysisStatus': TEXT_ANALYSIS_STATUS.pending },
        },
      })
      .lean<AnalyticsSnapshotLean[]>()
      .exec();

    for (const snapshot of snapshots) {
      for (const question of snapshot.questions) {
        if (
          question.text?.analysisStatus !== TEXT_ANALYSIS_STATUS.pending ||
          !question.text.analysisHash
        ) {
          continue;
        }

        const analysisHash = question.text.analysisHash;
        await this.markTextEnrichmentFailedByFields(
          snapshot,
          question.questionId,
          analysisHash,
          'Intelligence processing timed out',
        );
        this.inFlightEnrichments.delete(
          `${snapshot._id}:${question.questionId}:${analysisHash}`,
        );
      }
    }
  }

  private async markEnrichmentPending(
    snapshot: AnalyticsSnapshotLean,
    inputs: TextInput[],
  ) {
    await Promise.all(
      inputs.map(async (input) => {
        await this.snapshotModel.updateOne(
          { _id: snapshot._id, 'questions.questionId': input.questionId },
          {
            $set: {
              'questions.$.text.analysisStatus': TEXT_ANALYSIS_STATUS.pending,
              'questions.$.text.analysisHash': input.hash,
            },
            $unset: {
              'questions.$.text.analysisError': '',
              'questions.$.text.lastEnrichedAt': '',
            },
          },
        );
        this.emitTextAnalysisStatusChanged({
          formId: snapshot.formId,
          questionId: input.questionId,
          windowKey: snapshot.windowKey,
          window: snapshot.window,
          analysisStatus: TEXT_ANALYSIS_STATUS.pending,
          analysisHash: input.hash,
        });
      }),
    );
  }

  private async markTextEnrichmentFailed(
    snapshot: AnalyticsSnapshotLean,
    input: TextInput,
    errorMessage: string,
  ) {
    await this.markTextEnrichmentFailedByFields(
      snapshot,
      input.questionId,
      input.hash,
      errorMessage,
    );
  }

  private async markTextEnrichmentFailedByFields(
    snapshot: AnalyticsSnapshotLean,
    questionId: string,
    analysisHash: string,
    errorMessage: string,
  ) {
    const analysisError = errorMessage || 'Unknown error';
    const updateResult = await this.snapshotModel.updateOne(
      {
        _id: snapshot._id,
        questions: {
          $elemMatch: {
            questionId,
            'text.analysisHash': analysisHash,
            'text.analysisStatus': TEXT_ANALYSIS_STATUS.pending,
          },
        },
      },
      {
        $set: {
          'questions.$.text.analysisStatus': TEXT_ANALYSIS_STATUS.failed,
          'questions.$.text.analysisHash': analysisHash,
          'questions.$.text.analysisError': analysisError,
        },
      },
    );
    if (!updateResult.modifiedCount) {
      return;
    }

    this.emitTextAnalysisStatusChanged({
      formId: snapshot.formId,
      questionId,
      windowKey: snapshot.windowKey,
      window: snapshot.window,
      analysisStatus: TEXT_ANALYSIS_STATUS.failed,
      analysisHash,
      analysisError,
    });
  }
}
