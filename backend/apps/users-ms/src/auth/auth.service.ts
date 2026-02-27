import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import {
  JwtPayload,
  LegacyRefreshTokenPayload,
  RefreshTokenPayload,
} from '@app/common';
import { IUser } from '@app/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { isValidObjectId } from 'mongoose';
import { subtle, randomUUID } from 'crypto';
import {
  RefreshSession,
  RefreshSessionStatus,
} from './entities/refresh-session.entity';

type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

type RefreshTokenIssue = {
  token: string;
  expiresAt: Date;
};

type SessionRefreshPayload = RefreshTokenPayload;
type AnyRefreshPayload =
  | SessionRefreshPayload
  | LegacyRefreshTokenPayload
  | Record<string, unknown>;

@Injectable()
export class AuthService {
  private readonly maxActiveSessions = Math.max(
    1,
    parseInt(process.env.AUTH_MAX_ACTIVE_SESSIONS || '10', 10),
  );
  private readonly revokeRetentionDays = Math.max(
    1,
    parseInt(process.env.AUTH_REFRESH_REVOKED_RETENTION_DAYS || '30', 10),
  );
  private readonly legacyCompatEnabled =
    (process.env.AUTH_REFRESH_LEGACY_ENABLED || 'true').toLowerCase() ===
    'true';
  private readonly legacyCompatUntil = process.env.AUTH_REFRESH_LEGACY_UNTIL
    ? new Date(process.env.AUTH_REFRESH_LEGACY_UNTIL)
    : null;

  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectModel(RefreshSession.name)
    private readonly refreshSessionModel: Model<RefreshSession>,
  ) {}

  async validateUser(
    username: string,
    password: string,
  ): Promise<IUser | null> {
    const user = await this.usersService.findByEmail(username, true);
    if (user && (await compare(password, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _pw, ...safeUser } = user;
      return safeUser as IUser;
    }
    return null;
  }

  async login(payload: JwtPayload): Promise<AuthTokens> {
    if (!isValidObjectId(payload.sub)) {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    // Clear legacy token storage when issuing new-style session refresh tokens.
    await this.usersService.updateOne(user.id, { refresh_token: null });

    return this.issueNewSessionTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const decoded = this.verifyRefreshToken(refreshToken);
    if (!isValidObjectId(decoded.sub)) {
      throw new UnauthorizedException();
    }

    if (this.isSessionRefreshTokenPayload(decoded)) {
      return this.refreshSessionToken(decoded);
    }

    if (!this.isLegacyCompatActive() || !this.isLegacyRefreshTokenPayload(decoded)) {
      throw new UnauthorizedException();
    }

    return this.refreshLegacyToken(refreshToken, decoded.sub);
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    const decoded = this.verifyRefreshToken(refreshToken);
    if (!isValidObjectId(decoded.sub)) {
      throw new UnauthorizedException();
    }

    if (this.isSessionRefreshTokenPayload(decoded)) {
      await this.revokeSession(decoded.sid, 'LOGOUT');
      return { success: true };
    }

    if (!this.isLegacyCompatActive() || !this.isLegacyRefreshTokenPayload(decoded)) {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(decoded.sub);
    if (!user || user.refresh_token !== refreshToken) {
      throw new UnauthorizedException();
    }

    await this.usersService.updateOne(user.id, { refresh_token: null });
    return { success: true };
  }

  async logoutAllSessions(userId: string): Promise<{ success: boolean }> {
    if (!isValidObjectId(userId)) {
      throw new UnauthorizedException();
    }

    const now = new Date();
    const deleteAt = this.computeDeleteAt(now);
    await this.refreshSessionModel.updateMany(
      { userId, status: RefreshSessionStatus.ACTIVE },
      {
        $set: {
          status: RefreshSessionStatus.REVOKED,
          reason: 'LOGOUT_ALL',
          revokedAt: now,
          deleteAt,
        },
      },
    );

    await this.usersService.updateOne(userId, { refresh_token: null });
    return { success: true };
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

  private async refreshSessionToken(
    decoded: SessionRefreshPayload,
  ): Promise<AuthTokens> {
    const now = new Date();
    const nextJti = randomUUID();
    const nextRefresh = this.signRefreshToken({
      sub: decoded.sub,
      sid: decoded.sid,
      fid: decoded.fid,
      jti: nextJti,
      type: 'refresh',
    });

    const rotated = await this.refreshSessionModel
      .findOneAndUpdate(
        {
          sessionId: decoded.sid,
          familyId: decoded.fid,
          currentJti: decoded.jti,
          status: RefreshSessionStatus.ACTIVE,
          expiresAt: { $gt: now },
        },
        {
          $set: {
            currentJti: nextJti,
            lastUsedAt: now,
            lastRotatedAt: now,
            expiresAt: nextRefresh.expiresAt,
            revokedAt: null,
            reuseDetectedAt: null,
            reason: null,
            deleteAt: null,
          },
        },
        { new: true },
      )
      .lean<RefreshSession>()
      .exec();

    if (!rotated) {
      await this.handleFailedSessionRefresh(decoded, now);
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(decoded.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      access_token: this.signAccessToken(user),
      refresh_token: nextRefresh.token,
    };
  }

  private async handleFailedSessionRefresh(
    decoded: SessionRefreshPayload,
    now: Date,
  ): Promise<void> {
    const session = await this.refreshSessionModel
      .findOne({ sessionId: decoded.sid, familyId: decoded.fid })
      .lean<RefreshSession>()
      .exec();

    if (!session) {
      return;
    }

    if (
      session.status === RefreshSessionStatus.ACTIVE &&
      session.currentJti !== decoded.jti
    ) {
      await this.revokeFamily(decoded.fid, 'REUSE_DETECTED', now, true);
    }
  }

  private async refreshLegacyToken(
    refreshToken: string,
    userId: string,
  ): Promise<AuthTokens> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refresh_token || user.refresh_token !== refreshToken) {
      throw new UnauthorizedException();
    }

    await this.usersService.updateOne(user.id, { refresh_token: null });
    return this.issueNewSessionTokens(user);
  }

  private async issueNewSessionTokens(user: IUser): Promise<AuthTokens> {
    const now = new Date();
    const sid = randomUUID();
    const fid = randomUUID();
    const jti = randomUUID();
    const refresh = this.signRefreshToken({
      sub: user.id,
      sid,
      fid,
      jti,
      type: 'refresh',
    });

    await this.refreshSessionModel.create({
      userId: user.id,
      sessionId: sid,
      familyId: fid,
      currentJti: jti,
      status: RefreshSessionStatus.ACTIVE,
      issuedAt: now,
      lastUsedAt: now,
      lastRotatedAt: now,
      expiresAt: refresh.expiresAt,
      revokedAt: null,
      reuseDetectedAt: null,
      deleteAt: null,
      reason: null,
      userAgent: null,
      ip: null,
    });

    await this.enforceSessionLimit(user.id);

    return {
      access_token: this.signAccessToken(user),
      refresh_token: refresh.token,
    };
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    const overflow = await this.refreshSessionModel
      .find({ userId, status: RefreshSessionStatus.ACTIVE })
      .sort({ lastUsedAt: -1, issuedAt: -1 })
      .skip(this.maxActiveSessions)
      .select('_id')
      .lean<Array<{ _id: unknown }>>()
      .exec();

    if (!overflow.length) {
      return;
    }

    const now = new Date();
    const deleteAt = this.computeDeleteAt(now);
    const ids = overflow.map((item) => item._id);

    await this.refreshSessionModel.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: RefreshSessionStatus.REVOKED,
          reason: 'SESSION_LIMIT',
          revokedAt: now,
          deleteAt,
        },
      },
    );
  }

  private async revokeSession(sessionId: string, reason: string): Promise<void> {
    const now = new Date();
    await this.refreshSessionModel.updateOne(
      { sessionId, status: RefreshSessionStatus.ACTIVE },
      {
        $set: {
          status: RefreshSessionStatus.REVOKED,
          reason,
          revokedAt: now,
          deleteAt: this.computeDeleteAt(now),
        },
      },
    );
  }

  private async revokeFamily(
    familyId: string,
    reason: string,
    now: Date,
    markReuse: boolean,
  ): Promise<void> {
    const setUpdate: Record<string, unknown> = {
      status: RefreshSessionStatus.REVOKED,
      reason,
      revokedAt: now,
      deleteAt: this.computeDeleteAt(now),
    };
    if (markReuse) {
      setUpdate.reuseDetectedAt = now;
    }

    await this.refreshSessionModel.updateMany(
      { familyId, status: RefreshSessionStatus.ACTIVE },
      {
        $set: setUpdate,
      },
    );
  }

  private signAccessToken(user: Pick<IUser, 'id' | 'email' | 'userType'>): string {
    return this.jwtService.sign({
      username: user.email,
      sub: user.id,
      authType: user.userType,
    });
  }

  private signRefreshToken(payload: SessionRefreshPayload): RefreshTokenIssue {
    const token = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
    });
    const decoded = this.jwtService.decode(token) as
      | { exp?: number }
      | null;

    const expiresAt =
      decoded?.exp && Number.isFinite(decoded.exp)
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return { token, expiresAt };
  }

  private verifyRefreshToken(refreshToken: string): AnyRefreshPayload {
    try {
      return this.jwtService.verify(refreshToken) as AnyRefreshPayload;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private isSessionRefreshTokenPayload(
    payload: AnyRefreshPayload,
  ): payload is SessionRefreshPayload {
    const candidate = payload as SessionRefreshPayload;
    return (
      typeof candidate?.sub === 'string' &&
      typeof candidate?.sid === 'string' &&
      typeof candidate?.fid === 'string' &&
      typeof candidate?.jti === 'string' &&
      candidate?.type === 'refresh'
    );
  }

  private isLegacyRefreshTokenPayload(
    payload: AnyRefreshPayload,
  ): payload is LegacyRefreshTokenPayload {
    const candidate = payload as LegacyRefreshTokenPayload &
      Record<string, unknown>;
    return (
      typeof candidate?.sub === 'string' &&
      typeof candidate?.['sid'] === 'undefined' &&
      typeof candidate?.['fid'] === 'undefined' &&
      typeof candidate?.['jti'] === 'undefined'
    );
  }

  private computeDeleteAt(base: Date): Date {
    return new Date(
      base.getTime() + this.revokeRetentionDays * 24 * 60 * 60 * 1000,
    );
  }

  private isLegacyCompatActive(): boolean {
    if (!this.legacyCompatEnabled) {
      return false;
    }
    if (!this.legacyCompatUntil) {
      return true;
    }
    if (Number.isNaN(this.legacyCompatUntil.getTime())) {
      return true;
    }
    return Date.now() <= this.legacyCompatUntil.getTime();
  }
}
