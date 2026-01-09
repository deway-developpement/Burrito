import { InputType, Field, registerEnumType } from '@nestjs/graphql';
import { ICreateUser, UserType } from '@app/common';

enum UserTypeInput {
  STUDENT = UserType.STUDENT,
  TEACHER = UserType.TEACHER,
}

registerEnumType(UserTypeInput, {
  name: 'UserTypeNoAdmin',
});

@InputType()
export class CreateUserInput implements ICreateUser {
  @Field(() => String, { description: 'User email address' })
  email: string;

  @Field(() => String, { description: 'User password' })
  password: string;

  @Field(() => String, { description: 'User full name' })
  fullName: string;

  @Field(() => UserTypeInput, { description: 'User type' })
  userType: UserType;
}
