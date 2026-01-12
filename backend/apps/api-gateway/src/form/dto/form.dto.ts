import {
  ObjectType,
  Field,
  ID,
  HideField,
  registerEnumType,
} from '@nestjs/graphql';
import { QuestionDto } from './question.dto';
import { FilterableField, IDField } from '@nestjs-query/query-graphql';
import { FormStatus, IForm } from '@app/common';
import { UserDto } from '../../user/dto/user.dto';
import { GroupDto } from '../../group/dto/group.dto';

registerEnumType(FormStatus, { name: 'FormStatus' });

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

  @HideField()
  targetTeacherId?: string;

  @Field({ nullable: true })
  targetCourseId?: string;

  @Field(() => UserDto, { nullable: true })
  teacher?: UserDto;

  @Field(() => [GroupDto], { nullable: true })
  groups?: GroupDto[];

  @FilterableField(() => FormStatus)
  status: FormStatus;

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
