import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsNumber } from 'class-validator';

@InputType()
export class EvaluationAnswerInput {
  @Field()
  @IsString()
  questionId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  rating?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  text?: string;
}
