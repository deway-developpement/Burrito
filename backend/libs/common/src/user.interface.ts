export enum UserType {
  ADMIN = 3,
  TEACHER = 2,
  STUDENT = 1,
}

export interface User {
  // Mongoose always adds an id getter based on _id; explicitly type it so DTO requirements match.
  readonly id: string;

  readonly email: string;

  readonly password: string;

  readonly fullName: string;

  readonly userType: UserType;

  readonly refresh_token: string | null;

  readonly createdAt: Date;

  readonly updatedAt: Date;
}
