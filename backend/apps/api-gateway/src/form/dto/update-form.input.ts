import { InputType, PartialType } from '@nestjs/graphql';
import { CreateFormInput } from './create-form.input';

@InputType()
export class UpdateFormInput extends PartialType(CreateFormInput) {}
