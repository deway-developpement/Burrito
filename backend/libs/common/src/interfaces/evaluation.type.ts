export interface IEvaluationAnswer {
  readonly questionId: string;
  readonly rating?: number;
  readonly text?: string;
}

export interface IEvaluation {
  readonly id: string;
  readonly formId: string;
  readonly teacherId: string;
  readonly respondentToken: string;
  readonly answers: IEvaluationAnswer[];
  readonly createdAt: Date;
}
