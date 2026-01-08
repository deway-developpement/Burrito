import { ObjectType, Field, ID } from '@nestjs/graphql';
import { QuestionDto } from './question.dto';
import { FilterableField, IDField } from '@nestjs-query/query-graphql';
import { IForm } from '@app/common';

@ObjectType('Form')
export class FormDto implements IForm {
  @IDField(() => ID)
  id: string;

  @FilterableField()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => [QuestionDto])
  questions: QuestionDto[];

  @FilterableField({ nullable: true })
  targetTeacherId?: string;

  @FilterableField({ nullable: true })
  targetCourseId?: string;

  @FilterableField()
  isActive: boolean;

  @FilterableField({ nullable: true })
  startDate?: Date;

  @FilterableField({ nullable: true })
  endDate?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Whether the current user responded to the form',
  })
  userRespondedToForm?: boolean;
}
