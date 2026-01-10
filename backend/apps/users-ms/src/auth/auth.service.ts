import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '@app/common';
import { IUser } from '@app/common';
import { isValidObjectId } from 'mongoose';
import { subtle } from 'crypto';

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
    const user = await this.usersService.findByEmail(username, true);
    if (user && (await compare(password, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _pw, ...safeUser } = user;
      return safeUser as IUser;
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
      // Reconstruct full payload with user data from database
      const fullPayload: JwtPayload = {
        username: user.email,
        sub: user.id,
        authType: user.userType,
      };
      return this.login(fullPayload);
    } else {
      if (user)
        await this.usersService.updateOne(user.id, {
          refresh_token: null,
        });
      throw new UnauthorizedException();
    }
  }

  async generateFormHash(userId: string, formId: string): Promise<string> {
    const secret =
      this.configService.get<string>('jwt.secret') || 'default-secret';

    const encoder = new TextEncoder();
    const key = await subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signature = await subtle.sign(
      'HMAC',
      key,
      encoder.encode(userId + formId),
    );

    return Buffer.from(signature).toString('base64');
  }
}
