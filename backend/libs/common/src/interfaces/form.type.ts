export enum QuestionType {
  RATING = 'RATING',
  TEXT = 'TEXT',
}

export interface IQuestion {
  readonly id: string;

  readonly label: string;

  readonly type: QuestionType;

  readonly required: boolean;
}

export interface IForm {
  readonly id: string;

  readonly title: string;

  readonly description?: string;

  readonly questions: IQuestion[];

  readonly targetTeacherId?: string;

  readonly targetCourseId?: string;

  readonly isActive: boolean;

  readonly startDate?: Date;

  readonly endDate?: Date;

  readonly createdAt?: Date;

  readonly updatedAt?: Date;
}
