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

  private async sendWithTimeout<T>(observable: Observable<T>): Promise<T> {
    return firstValueFrom(
      observable.pipe(
        timeout(MICROSERVICE_TIMEOUT_MS),
        catchError((err) => {
          if (err instanceof TimeoutError) {
            throw new GatewayTimeoutException('Auth service timed out');
          }
          throw err;
        }),
      ),
    );
  }
}
