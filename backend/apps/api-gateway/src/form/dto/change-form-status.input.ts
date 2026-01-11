import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsString } from 'class-validator';
import { FormStatus } from '@app/common';

@InputType()
export class ChangeFormStatusInput {
  @Field()
  @IsString()
  id: string;

  @Field(() => FormStatus)
  @IsEnum(FormStatus)
  status: FormStatus;
}
