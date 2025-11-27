import {
  FilterableField,
  IDField,
  PagingStrategies,
  QueryOptions,
} from '@nestjs-query/query-graphql';
import { ObjectType, GraphQLISODateTime, Field, ID } from '@nestjs/graphql';

@ObjectType('User')
@QueryOptions({
  pagingStrategy: PagingStrategies.CURSOR,
})
export class UserDto {
  @IDField(() => ID, { description: 'User ID' })
  id: string;

  @FilterableField(() => String, { description: 'User email address' })
  email: string;

  @FilterableField(() => String, { description: 'User full name' })
  fullName: string;

  @Field(() => GraphQLISODateTime, { description: 'Creation date' })
  createdAt: Date;

  @Field(() => GraphQLISODateTime, { description: 'Last update date' })
  updatedAt: Date;
}
