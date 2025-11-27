import { UserType } from '@app/common';

export interface AuthCredentials {
  id: string;
  email: string;
  authType: UserType;
}

export interface JwtPayload {
  username: string;
  sub: string;
  authType: UserType;
}
