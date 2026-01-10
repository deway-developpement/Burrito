import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IEvaluation, IEvaluationAnswer } from '@app/common';

@Schema({ _id: false })
export class EvaluationAnswer implements IEvaluationAnswer {
  @Prop({ required: true })
  questionId: string;

  @Prop()
  rating?: number;

  @Prop()
  text?: string;
}

export const EvaluationAnswerSchema =
  SchemaFactory.createForClass(EvaluationAnswer);

@Schema({
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Evaluation extends Document implements IEvaluation {
  declare readonly id: string;

  @Prop({ required: true })
  formId: string;

  @Prop({ required: true })
  teacherId: string;

  // Instead of studentId, store a random token (or hash of studentId+formId+secret)
  @Prop({ required: true })
  respondentToken: string;

  @Prop({ type: [EvaluationAnswerSchema], default: [] })
  answers: EvaluationAnswer[];

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const EvaluationSchema = SchemaFactory.createForClass(Evaluation);

// Enforce one response per form per respondent token
EvaluationSchema.index({ formId: 1, respondentToken: 1 }, { unique: true });
