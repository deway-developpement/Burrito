import { InputType, Field } from '@nestjs/graphql';
import { GraphQLScalarType } from 'graphql'; // Import this
import { GraphQLJSON } from 'graphql-type-json';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  IsEnum,
} from 'class-validator';
import { FormStatus } from '@app/common';

// --- FIX: RENAME THE SCALAR TO AVOID COLLISION ---
// We create a new scalar that works exactly like GraphQLJSON
// but carries the name 'RawJSON' so it doesn't crash the schema.
const RawJSON = new GraphQLScalarType({
  ...GraphQLJSON.toConfig(),
  name: 'RawJSON', 
});

@InputType()
export class CreateFormInput {
  @Field()
  @IsString()
  title: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  // --- VULNERABLE FIELD ---
  // Use our renamed 'RawJSON' scalar here
  @Field(() => [RawJSON]) 
  @IsArray()
  questions: any[]; 

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  targetTeacherId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  targetCourseId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @Field(() => FormStatus, { nullable: true })
  @IsOptional()
  @IsEnum(FormStatus)
  status?: FormStatus;
}