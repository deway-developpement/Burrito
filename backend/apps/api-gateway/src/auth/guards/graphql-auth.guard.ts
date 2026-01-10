/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  ForbiddenException,
  Injectable,
  ExecutionContext,
  createParamDecorator,
  Type,
  mixin,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard, IAuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthCredentials } from '../../../../../libs/common/src/interfaces/auth.type';
import { UserType } from '../../../../../libs/common/src';
import { UserService } from '../../user/user.service';

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

@Injectable()
export class GqlCurrentUserGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const can = (await super.canActivate(context)) as boolean;
    if (!can) return false;

    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext().req as Request & { user?: AuthCredentials };
    const user = req.user;

    if (!user) return false;

    return user.id === ctx.getArgs().input.id;
  }

  getRequest(context: ExecutionContext): Request {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}

@Injectable()
export class GqlEmailVerifiedGuard extends AuthGuard('jwt') {
  constructor(private readonly userService: UserService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const can = (await super.canActivate(context)) as boolean;
    if (!can) return false;

    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext().req as Request & { user?: AuthCredentials };
    const user = req.user;

    if (!user) return false;

    const fullUser = await this.userService.findById(user.id);
    if (!fullUser?.emailVerified) {
      throw new ForbiddenException('Email not verified');
    }

    return true;
  }

  getRequest(context: ExecutionContext): Request {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}

export function GqlOrGuard(
  ...guards: Array<Type<IAuthGuard> | IAuthGuard>
): Type<any> {
  @Injectable()
  class OrGuard extends AuthGuard('jwt') {
    private guardInstances: IAuthGuard[];

    constructor() {
      super();
      this.guardInstances = guards.map((guard) =>
        typeof guard === 'function' ? new guard() : guard,
      );
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
      for (const guard of this.guardInstances) {
        if (await guard.canActivate(context)) {
          return true;
        }
      }
      return false;
    }
  }

  return mixin(OrGuard);
}

export function GqlAndGuard(
  ...guards: Array<Type<IAuthGuard> | IAuthGuard>
): Type<any> {
  @Injectable()
  class AndGuard extends AuthGuard('jwt') {
    private guardInstances: IAuthGuard[];

    constructor() {
      super();
      this.guardInstances = guards.map((guard) =>
        typeof guard === 'function' ? new guard() : guard,
      );
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
      for (const guard of this.guardInstances) {
        if (!(await guard.canActivate(context))) {
          return false;
        }
      }
      return true;
    }
  }

  return mixin(AndGuard);
}

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext): AuthCredentials => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  },
);
