import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class AnalyticsWindow {
  @Prop()
  from?: Date;

  @Prop()
  to?: Date;
}

@Schema({ _id: false })
export class NpsBuckets {
  @Prop({ default: 0 })
  promotersCount: number;

  @Prop({ default: 0 })
  passivesCount: number;

  @Prop({ default: 0 })
  detractorsCount: number;

  @Prop({ default: 0 })
  promotersPct: number;

  @Prop({ default: 0 })
  passivesPct: number;

  @Prop({ default: 0 })
  detractorsPct: number;
}

@Schema({ _id: false })
export class NpsSummary {
  @Prop({ default: 0 })
  score: number;

  @Prop({ default: 0 })
  promotersPct: number;

  @Prop({ default: 0 })
  passivesPct: number;

  @Prop({ default: 0 })
  detractorsPct: number;

  @Prop({ default: 0 })
  promotersCount: number;

  @Prop({ default: 0 })
  passivesCount: number;

  @Prop({ default: 0 })
  detractorsCount: number;
}

@Schema({ _id: false })
export class RatingStats {
  @Prop({ default: 0 })
  avg: number;

  @Prop({ default: 0 })
  median: number;

  @Prop({ default: 0 })
  min: number;

  @Prop({ default: 0 })
  max: number;

  @Prop({ type: Map, of: Number, default: {} })
  distribution: Record<number, number>;

  @Prop({ type: NpsBuckets, default: () => ({}) })
  npsBuckets: NpsBuckets;
}

@Schema({ _id: false })
export class SentimentStats {
  @Prop({ default: 0 })
  positivePct: number;

  @Prop({ default: 0 })
  neutralPct: number;

  @Prop({ default: 0 })
  negativePct: number;
}

@Schema({ _id: false })
export class TextIdea {
  @Prop({ required: true })
  idea: string;

  @Prop({ default: 0 })
  count: number;
}

@Schema({ _id: false })
export class TextStats {
  @Prop({ default: 0 })
  responseCount: number;

  @Prop({ type: [TextIdea], default: [] })
  topIdeas: TextIdea[];

  @Prop({ type: SentimentStats })
  sentiment?: SentimentStats;

  @Prop()
  analysisStatus?: string;

  @Prop()
  analysisHash?: string;

  @Prop()
  lastEnrichedAt?: Date;

  @Prop()
  analysisError?: string;
}

@Schema({ _id: false })
export class QuestionAnalytics {
  @Prop({ required: true })
  questionId: string;

  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  type: string;

  @Prop({ default: 0 })
  answeredCount: number;

  @Prop({ type: RatingStats })
  rating?: RatingStats;

  @Prop({ type: TextStats })
  text?: TextStats;
}

@Schema({ _id: false })
export class TimeBucket {
  @Prop({ required: true })
  bucketStart: Date;

  @Prop({ default: 0 })
  count: number;
}

@Schema({
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class AnalyticsSnapshot extends Document {
  declare readonly id: string;

  @Prop({ required: true })
  formId: string;

  @Prop({ required: true })
  windowKey: string;

  @Prop({ type: AnalyticsWindow })
  window?: AnalyticsWindow;

  @Prop({ required: true })
  generatedAt: Date;

  @Prop({ required: true })
  staleAt: Date;

  @Prop({ default: 0 })
  totalResponses: number;

  @Prop({ type: NpsSummary, default: () => ({}) })
  nps: NpsSummary;

  @Prop({ type: [QuestionAnalytics], default: [] })
  questions: QuestionAnalytics[];

  @Prop({ type: [TimeBucket], default: [] })
  timeSeries: TimeBucket[];
}

export const AnalyticsSnapshotSchema =
  SchemaFactory.createForClass(AnalyticsSnapshot);

AnalyticsSnapshotSchema.index({ formId: 1, windowKey: 1 }, { unique: true });
AnalyticsSnapshotSchema.index({ staleAt: 1 }, { expireAfterSeconds: 0 });
