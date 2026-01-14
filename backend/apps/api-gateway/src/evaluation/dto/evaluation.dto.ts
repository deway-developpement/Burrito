import { Field, ID, ObjectType } from '@nestjs/graphql';
import { FilterableField, IDField } from '@nestjs-query/query-graphql';
import { IEvaluation } from '@app/common';
import { EvaluationAnswerDto } from './answer.dto';

@ObjectType('Evaluation')
export class EvaluationDto implements IEvaluation {
  @IDField(() => ID)
  id: string;

  @FilterableField()
  formId: string;

  @FilterableField()
  teacherId: string;

  @Field()
  respondentToken: string;

  @Field(() => [EvaluationAnswerDto])
  answers: EvaluationAnswerDto[];

  @FilterableField()
  createdAt: Date;
}
