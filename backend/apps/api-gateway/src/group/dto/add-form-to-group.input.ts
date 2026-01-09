import { InputType, Field } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class AddFormToGroupInput {
  @Field()
  @IsString()
  groupId: string;

  @Field()
  @IsString()
  formId: string;
}
