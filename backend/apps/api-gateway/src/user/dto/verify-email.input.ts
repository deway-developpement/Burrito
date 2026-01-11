import { Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class VerifyEmailInput {
  @Field()
  @IsString()
  token: string;
}
