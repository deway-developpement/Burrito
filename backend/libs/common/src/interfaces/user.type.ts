export enum UserType {
  ADMIN = 3,
  TEACHER = 2,
  STUDENT = 1,
}

export interface IUser {
  // Mongoose always adds an id getter based on _id; explicitly type it so DTO requirements match.
  readonly id: string;

  readonly email: string;

  readonly fullName: string;

  readonly userType: UserType;

  readonly refresh_token: string | null;

  readonly createdAt: Date;

  readonly updatedAt: Date;

  readonly notificationPreferences?: INotificationPreferences;
}

export interface ICreateUser {
  email: string;
  password: string;
  fullName: string;
  userType: UserType;
}

export interface IUpdateUser {
  id?: string;
  email?: string;
  password?: string;
  fullName?: string;
  userType?: UserType;
  refresh_token?: string | null;
}

export interface INotificationPreferences {
  emailEnabled?: boolean;
  language?: string;
  digestFrequency?: string;
}
