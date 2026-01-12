import { InputType, Field } from '@nestjs/graphql';
import { QuestionInput } from './question.input';
import {
  IsString,
  IsOptional,
  IsDateString,
  ValidateNested,
  IsArray,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FormStatus } from '@app/common';

@InputType()
export class CreateFormInput {
  @Field()
  @IsString()
  title: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => [QuestionInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionInput)
  questions: QuestionInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  targetTeacherId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  targetCourseId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @Field(() => FormStatus, { nullable: true })
  @IsOptional()
  @IsEnum(FormStatus)
  status?: FormStatus;
}
