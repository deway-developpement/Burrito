import { InputType, Field } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class AddUserToGroupInput {
  @Field()
  @IsString()
  groupId: string;

  @Field()
  @IsString()
  memberId: string;
}
