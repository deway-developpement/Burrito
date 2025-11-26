import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './interface/auth.type';
import type { Request } from 'express';
import { User } from '../user/entities/user.entity';
import { isValidObjectId } from 'mongoose';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(username: string, password: string): Promise<User | null> {
    // Find the user by email
    const user = await this.usersService.findByEmail(username);
    if (user && (await compare(password, user.password))) {
      return user;
    }
    return null;
  }

  async login(user: User) {
    console.log('Logging in user:', user);
    const payload: JwtPayload = {
      username: user.email,
      sub: user.id,
      authType: user.userType,
    };
    const refresh_token = this.jwtService.sign(
      { sub: user.id },
      { expiresIn: this.configService.get<number>('jwt.refreshExpiresIn') },
    );
    await this.usersService.updateOne(user.id, {
      refresh_token: refresh_token,
    });
    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: refresh_token,
    };
  }

  async refresh(req: Request) {
    if (!req.headers?.refresh_token) throw new UnauthorizedException();
    const decoded: JwtPayload = this.jwtService.verify(
      req.headers.refresh_token as string,
    );
    if (!isValidObjectId(decoded.sub)) {
      throw new UnauthorizedException();
    }
    const user = await this.usersService.findById(decoded.sub);
    if (req.headers.refresh_token === user?.refresh_token) {
      return this.login(user);
    } else {
      if (user)
        await this.usersService.updateOne(user.id, {
          refresh_token: null,
        });
      throw new UnauthorizedException();
    }
  }
}
