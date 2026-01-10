export interface IGroup {
  readonly id: string;

  readonly name: string;

  readonly description?: string;

  readonly createdAt: Date;

  readonly updatedAt: Date;
}

export interface IMembership {
  readonly id: string;

  readonly groupId: string;

  readonly memberId: string;
}

export interface IGroupForm {
  readonly id: string;

  readonly groupId: string;

  readonly formId: string;
}
