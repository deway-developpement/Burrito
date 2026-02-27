import {
  GatewayTimeoutException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { MICROSERVICE_TIMEOUT_MS } from '../constants';
import { JwtPayload } from '@app/common';
import type { Request } from 'express';
import { IUser } from '@app/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  Observable,
  TimeoutError,
  catchError,
  firstValueFrom,
  timeout,
} from 'rxjs';

@Injectable()
export class AuthService {
  constructor(
    @Inject('USER_SERVICE') // must match ClientsModule.register({ name: 'USER_SERVICE', ... })
    private readonly userClient: ClientProxy,
  ) {}

  async validateUser(
    username: string,
    password: string,
  ): Promise<IUser | null> {
    // Find the user by email
    const user = await this.sendWithTimeout(
      this.userClient.send<IUser | null>(
        { cmd: 'auth.validateUser' },
        { username, password },
      ),
    );
    return user;
  }

  async login(user: IUser) {
    const payload: JwtPayload = {
      username: user.email,
      sub: user.id,
      authType: user.userType,
    };
    return this.sendWithTimeout(
      this.userClient.send<{ access_token: string; refresh_token: string }>(
        { cmd: 'auth.login' },
        payload,
      ),
    );
  }

  async refresh(req: Request) {
    if (!req.headers?.refresh_token) throw new UnauthorizedException();
    return this.sendWithTimeout(
      this.userClient.send<{ access_token: string; refresh_token: string }>(
        { cmd: 'auth.refresh' },
        { refreshToken: req.headers.refresh_token as string },
      ),
    );
  }

  async logout(req: Request) {
    if (!req.headers?.refresh_token) throw new UnauthorizedException();
    return this.sendWithTimeout(
      this.userClient.send<{ success: boolean }>(
        { cmd: 'auth.logout' },
        { refreshToken: req.headers.refresh_token as string },
      ),
    );
  }

  async logoutAllSessions(userId: string) {
    return this.sendWithTimeout(
      this.userClient.send<{ success: boolean }>(
        { cmd: 'auth.logoutAllSessions' },
        { userId },
      ),
    );
  }

  private async sendWithTimeout<T>(observable: Observable<T>): Promise<T> {
    return firstValueFrom(
      observable.pipe(
        timeout(MICROSERVICE_TIMEOUT_MS),
        catchError((err) => {
          if (err instanceof TimeoutError) {
            throw new GatewayTimeoutException('Auth service timed out');
          }
          if (this.isUnauthorizedError(err)) {
            throw new UnauthorizedException();
          }
          throw err;
        }),
      ),
    );
  }

  private isUnauthorizedError(error: unknown): boolean {
    const err = error as Record<string, unknown> | undefined;
    const statusCandidates = [
      err?.['status'],
      err?.['statusCode'],
      (err?.['response'] as Record<string, unknown> | undefined)?.['status'],
      (err?.['response'] as Record<string, unknown> | undefined)?.[
        'statusCode'
      ],
      (err?.['error'] as Record<string, unknown> | undefined)?.['status'],
      (err?.['error'] as Record<string, unknown> | undefined)?.['statusCode'],
    ]
      .map((value) => (typeof value === 'number' ? value : Number(value)))
      .filter((value) => Number.isFinite(value));

    if (statusCandidates.includes(401) || statusCandidates.includes(403)) {
      return true;
    }

    const message = this.extractErrorMessage(error).toLowerCase();
    return (
      message.includes('unauthorized') ||
      message.includes('invalid token') ||
      message.includes('jwt')
    );
  }

  private extractErrorMessage(error: unknown): string {
    if (!error) {
      return '';
    }
    if (error instanceof Error) {
      return error.message || '';
    }
    if (typeof error === 'string') {
      return error;
    }

    const err = error as Record<string, unknown>;
    const nestedMessage =
      err['message'] ??
      (err['response'] as Record<string, unknown> | undefined)?.['message'] ??
      (err['error'] as Record<string, unknown> | undefined)?.['message'];

    if (typeof nestedMessage === 'string') {
      return nestedMessage;
    }
    if (Array.isArray(nestedMessage)) {
      return nestedMessage.join(' ');
    }
    try {
      return JSON.stringify(error);
    } catch {
      return '';
    }
  }
}
