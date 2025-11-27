import { UnauthorizedException } from '@nestjs/common';
import { FieldMiddleware, MiddlewareContext, NextFn } from '@nestjs/graphql';
import { UserType } from '@app/common';

export const fieldMiddleware: FieldMiddleware = async (
  ctx: MiddlewareContext,
  next: NextFn,
): Promise<any> => {
  const value: unknown = await next();
  const context = ctx.context as {
    req: { user: { id: string; credidential: UserType } };
    ignoreError?: boolean;
  };
  const source = ctx.source as { id: string };

  const id = context.req.user?.id;
  const creditential = context.req.user?.credidential;

  if (creditential >= UserType.ADMIN || source.id == id) {
    return value;
  } else if (context.ignoreError) {
    return value;
  }
  throw new UnauthorizedException(
    "You don't have the right to access this field",
  );
};
