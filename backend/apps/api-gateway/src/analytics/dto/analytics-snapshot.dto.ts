import {
  Field,
  Float,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

export enum TextAnalysisStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  DISABLED = 'DISABLED',
  FAILED = 'FAILED',
}

registerEnumType(TextAnalysisStatus, { name: 'TextAnalysisStatus' });

@InputType()
export class AnalyticsWindowInput {
  @Field({ nullable: true })
  from?: Date;

  @Field({ nullable: true })
  to?: Date;
}

@ObjectType()
export class AnalyticsWindowDto {
  @Field({ nullable: true })
  from?: Date;

  @Field({ nullable: true })
  to?: Date;
}

@ObjectType()
export class NpsBucketsDto {
  @Field(() => Int)
  promotersCount: number;

  @Field(() => Int)
  passivesCount: number;

  @Field(() => Int)
  detractorsCount: number;

  @Field(() => Float)
  promotersPct: number;

  @Field(() => Float)
  passivesPct: number;

  @Field(() => Float)
  detractorsPct: number;
}

@ObjectType()
export class NpsSummaryDto {
  @Field(() => Float)
  score: number;

  @Field(() => Float)
  promotersPct: number;

  @Field(() => Float)
  passivesPct: number;

  @Field(() => Float)
  detractorsPct: number;

  @Field(() => Int)
  promotersCount: number;

  @Field(() => Int)
  passivesCount: number;

  @Field(() => Int)
  detractorsCount: number;
}

@ObjectType()
export class RatingBucketDto {
  @Field(() => Int)
  rating: number;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class RatingStatsDto {
  @Field(() => Float)
  avg: number;

  @Field(() => Float)
  median: number;

  @Field(() => Float)
  min: number;

  @Field(() => Float)
  max: number;

  @Field(() => [RatingBucketDto])
  distribution: RatingBucketDto[];

  @Field(() => NpsBucketsDto)
  npsBuckets: NpsBucketsDto;
}

@ObjectType()
export class SentimentStatsDto {
  @Field(() => Float)
  positivePct: number;

  @Field(() => Float)
  neutralPct: number;

  @Field(() => Float)
  negativePct: number;
}

@ObjectType()
export class TextIdeaDto {
  @Field()
  idea: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class TextStatsDto {
  @Field(() => Int)
  responseCount: number;

  @Field(() => [TextIdeaDto])
  topIdeas: TextIdeaDto[];

  @Field(() => SentimentStatsDto, { nullable: true })
  sentiment?: SentimentStatsDto;

  @Field(() => TextAnalysisStatus, { nullable: true })
  analysisStatus?: TextAnalysisStatus;

  @Field({ nullable: true })
  analysisHash?: string;

  @Field({ nullable: true })
  lastEnrichedAt?: Date;

  @Field({ nullable: true })
  analysisError?: string;
}

@ObjectType()
export class AnalyticsTextAnalysisUpdateDto {
  @Field()
  formId: string;

  @Field()
  questionId: string;

  @Field()
  windowKey: string;

  @Field(() => AnalyticsWindowDto, { nullable: true })
  window?: AnalyticsWindowDto;

  @Field(() => TextAnalysisStatus)
  analysisStatus: TextAnalysisStatus;

  @Field({ nullable: true })
  analysisHash?: string;

  @Field({ nullable: true })
  analysisError?: string;

  @Field({ nullable: true })
  lastEnrichedAt?: Date;

  @Field(() => [TextIdeaDto], { nullable: true })
  topIdeas?: TextIdeaDto[];

  @Field(() => SentimentStatsDto, { nullable: true })
  sentiment?: SentimentStatsDto;
}

@ObjectType()
export class QuestionAnalyticsDto {
  @Field()
  questionId: string;

  @Field()
  label: string;

  @Field()
  type: string;

  @Field(() => Int)
  answeredCount: number;

  @Field(() => RatingStatsDto, { nullable: true })
  rating?: RatingStatsDto;

  @Field(() => TextStatsDto, { nullable: true })
  text?: TextStatsDto;
}

@ObjectType()
export class TimeBucketDto {
  @Field()
  bucketStart: Date;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class AnalyticsSnapshotDto {
  @Field()
  formId: string;

  @Field(() => AnalyticsWindowDto, { nullable: true })
  window?: AnalyticsWindowDto;

  @Field()
  generatedAt: Date;

  @Field()
  staleAt: Date;

  @Field(() => Int)
  totalResponses: number;

  @Field(() => NpsSummaryDto)
  nps: NpsSummaryDto;

  @Field(() => [QuestionAnalyticsDto])
  questions: QuestionAnalyticsDto[];

  @Field(() => [TimeBucketDto])
  timeSeries: TimeBucketDto[];
}
