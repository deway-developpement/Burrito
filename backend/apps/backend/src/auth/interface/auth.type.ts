export enum AuthType {
  student = 0,
  teacher = 1,
  admin = 2,
}

export interface AuthCredentials {
  id: string;
  email: string;
  authType: AuthType;
}

export interface JwtPayload {
  username: string;
  sub: string;
  authType: AuthType;
}
