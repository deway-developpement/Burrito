import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '@app/common';
import type { Request } from 'express';
import { IUser } from '@app/common';
import { isValidObjectId } from 'mongoose';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(
    username: string,
    password: string,
  ): Promise<IUser | null> {
    // Find the user by email
    const user = await this.usersService.findByEmail(username);
    if (user && (await compare(password, user.password))) {
      return user;
    }
    return null;
  }

  async login(payload: JwtPayload) {
    const refresh_token = this.jwtService.sign(
      { sub: payload.sub },
      { expiresIn: this.configService.get<number>('jwt.refreshExpiresIn') },
    );
    await this.usersService.updateOne(payload.sub, {
      refresh_token: refresh_token,
    });
    return {
      access_token: this.jwtService.sign({
        username: payload.username,
        sub: payload.sub,
        authType: payload.authType,
      }),
      refresh_token: refresh_token,
    };
  }

  async refresh(refresh_token: string) {
    const decoded: JwtPayload = this.jwtService.verify(refresh_token);
    if (!isValidObjectId(decoded.sub)) {
      throw new UnauthorizedException();
    }
    const user = await this.usersService.findById(decoded.sub);
    if (refresh_token === user?.refresh_token) {
      return this.login(decoded);
    } else {
      if (user)
        await this.usersService.updateOne(user.id, {
          refresh_token: null,
        });
      throw new UnauthorizedException();
    }
  }
}
