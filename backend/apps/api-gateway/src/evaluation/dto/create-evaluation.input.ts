import { Field, HideField, InputType } from '@nestjs/graphql';
import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EvaluationAnswerInput } from './answer.input';

@InputType()
export class CreateEvaluationInput {
  @Field()
  @IsString()
  formId: string;

  @Field()
  @IsString()
  teacherId: string;

  @HideField()
  @IsString()
  respondentToken: string;

  @Field(() => [EvaluationAnswerInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvaluationAnswerInput)
  answers: EvaluationAnswerInput[];
}
