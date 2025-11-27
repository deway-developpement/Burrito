/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  ExecutionContext,
  createParamDecorator,
  Type,
  mixin,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthCredentials } from '../../../../../libs/common/src/interfaces/auth.type';
import { UserType } from '../../../../../libs/common/src';

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext): Request {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}

export function GqlCredentialGuard(minRole: UserType): Type<any> {
  @Injectable()
  class JwtRoleGuard extends AuthGuard('jwt') {
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const can = (await super.canActivate(context)) as boolean;
      if (!can) return false;

      const ctx = GqlExecutionContext.create(context);
      const req = ctx.getContext().req as Request & { user?: AuthCredentials };
      const user = req.user;

      if (!user) return false;

      return user.authType >= minRole;
    }

    getRequest(context: ExecutionContext) {
      const ctx = GqlExecutionContext.create(context);
      return ctx.getContext().req;
    }
  }

  return mixin(JwtRoleGuard);
}

@Injectable()
export class GqlSkipFieldGuard extends AuthGuard('Empty') {
  getRequest(context: ExecutionContext): Request {
    const ctx = GqlExecutionContext.create(context);
    ctx.getContext().ignoreError = true;
    return ctx.getContext().req;
  }
}

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext): AuthCredentials => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  },
);
