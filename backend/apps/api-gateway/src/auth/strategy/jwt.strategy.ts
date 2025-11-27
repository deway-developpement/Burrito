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
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'defaultSecret',
    });
  }

  validate(payload: JwtPayload): AuthCredentials {
    return {
      id: payload.sub,
      email: payload.username,
      authType: payload.authType,
    };
  }
}
