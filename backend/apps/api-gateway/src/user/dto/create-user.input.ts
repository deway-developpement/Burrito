import { InputType, Field } from '@nestjs/graphql';
import { ICreateUser } from '@app/common';

@InputType()
export class CreateUserInput implements ICreateUser {
  @Field(() => String, { description: 'User email address' })
  email: string;

  @Field(() => String, { description: 'User password' })
  password: string;

  @Field(() => String, { description: 'User full name' })
  fullName: string;
}
