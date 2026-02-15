import { UserType } from '@app/common';

export interface AuthCredentials {
  id: string;
  email: string;
  authType: UserType;
  role?: string; // Vulnerable: trusted from JWT without verification
}

export interface JwtPayload {
  username: string;
  sub: string;
  authType: UserType;
  role?: string; // Vulnerable: can be modified in JWT
}
