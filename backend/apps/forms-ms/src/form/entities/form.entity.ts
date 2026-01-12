// apps/forms-ms/src/form/entities/form.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { FormStatus, IForm, IQuestion, QuestionType } from '@app/common';

@Schema({
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Question extends Document implements IQuestion {
  declare readonly id: string;

  @Prop({ required: true })
  readonly label: string;

  @Prop({ enum: QuestionType, required: true, type: String })
  readonly type: QuestionType;

  @Prop({ default: false })
  readonly required: boolean;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Form extends Document implements IForm {
  declare readonly id: string;

  @Prop({ required: true })
  readonly title: string;

  @Prop()
  readonly description?: string;

  @Prop({ type: [QuestionSchema], default: [] })
  readonly questions: Question[];

  @Prop()
  readonly targetTeacherId?: string;

  @Prop()
  readonly targetCourseId?: string;

  @Prop({ enum: FormStatus, default: FormStatus.DRAFT, type: String })
  readonly status: FormStatus;

  @Prop()
  readonly startDate?: Date;

  @Prop()
  readonly endDate?: Date;
}

export const FormSchema = SchemaFactory.createForClass(Form);
