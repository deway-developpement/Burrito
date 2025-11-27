import { InputType, Field } from '@nestjs/graphql';
import { IsBoolean, IsEnum, IsString } from 'class-validator';
import { QuestionType } from '@app/common';

@InputType()
export class QuestionInput {
  @Field()
  @IsString()
  label: string;

  @Field(() => QuestionType)
  @IsEnum(QuestionType)
  type: QuestionType;

  @Field({ defaultValue: false })
  @IsBoolean()
  required: boolean;
}
