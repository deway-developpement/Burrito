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

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  fid: string;
  jti: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}
