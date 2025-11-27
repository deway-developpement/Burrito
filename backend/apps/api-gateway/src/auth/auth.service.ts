import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from '@app/common';
import type { Request } from 'express';
import { IUser } from '@app/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

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
    const user = await firstValueFrom(
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
    return firstValueFrom(
      this.userClient.send<{ access_token: string; refresh_token: string }>(
        { cmd: 'auth.login' },
        payload,
      ),
    );
  }

  async refresh(req: Request) {
    if (!req.headers?.refresh_token) throw new UnauthorizedException();
    return firstValueFrom(
      this.userClient.send<{ access_token: string; refresh_token: string }>(
        { cmd: 'auth.refresh' },
        { refreshToken: req.headers.refresh_token as string },
      ),
    );
  }
}
