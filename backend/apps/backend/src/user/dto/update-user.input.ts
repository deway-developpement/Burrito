import { CreateUserInput } from './create-user.input';
import { InputType, Field, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateUserInput extends PartialType(CreateUserInput) {
  @Field(() => String, { description: 'User ID' })
  id?: string;

  @Field(() => String, {
    description: 'Refresh token for the user',
    nullable: true,
  })
  refresh_token?: string | null;
}
