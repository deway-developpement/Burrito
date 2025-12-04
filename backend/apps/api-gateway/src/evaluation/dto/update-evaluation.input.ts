import { InputType, OmitType, PartialType } from '@nestjs/graphql';
import { CreateEvaluationInput } from './create-evaluation.input';

@InputType()
export class UpdateEvaluationInput extends OmitType(
  PartialType(CreateEvaluationInput),
  ['formId', 'respondentToken'] as const,
) {}
