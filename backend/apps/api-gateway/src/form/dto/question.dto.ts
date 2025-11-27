import { ObjectType, Field, registerEnumType, ID } from '@nestjs/graphql';
import { IQuestion, QuestionType } from '@app/common';
import { FilterableField, IDField } from '@nestjs-query/query-graphql';

registerEnumType(QuestionType, {
  name: 'QuestionType',
});

@ObjectType('Question')
export class QuestionDto implements IQuestion {
  @IDField(() => ID)
  id: string;

  @Field()
  label: string;

  @FilterableField(() => QuestionType)
  type: QuestionType;

  @FilterableField()
  required: boolean;
}
