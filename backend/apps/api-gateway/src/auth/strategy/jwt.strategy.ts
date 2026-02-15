import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuthCredentials,
  JwtPayload,
} from '../../../../../libs/common/src/interfaces/auth.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const jwtSecret = configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      throw new Error('JWT secret is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      algorithms: ['HS256', 'none'],
    });
  }

  validate(payload: JwtPayload): AuthCredentials {
    // VULNERABILITY: Trusting JWT payload without database verification
    // This allows users to modify their role by tampering with the JWT
    return {
      id: payload.sub,
      email: payload.username,
      authType: payload.authType,
      role: payload.role,
    };
  }
}
