import { Field, ObjectType } from '@nestjs/graphql';
import { IEvaluationAnswer } from '@app/common';

@ObjectType('EvaluationAnswer')
export class EvaluationAnswerDto implements IEvaluationAnswer {
  @Field()
  questionId: string;

  @Field({ nullable: true })
  rating?: number;

  @Field({ nullable: true })
  text?: string;
}
