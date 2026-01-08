import { ObjectType, Field, ID, GraphQLISODateTime } from '@nestjs/graphql';
import { FilterableField, IDField } from '@nestjs-query/query-graphql';
import type { IGroup } from '@app/common';

@ObjectType('Group')
export class GroupDto implements IGroup {
  @IDField(() => ID)
  id: string;

  @FilterableField()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}
