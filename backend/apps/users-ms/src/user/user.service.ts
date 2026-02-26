import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import { MongooseQueryService } from '@nestjs-query/query-mongoose';
import {
  DeepPartial,
  Filter,
  QueryService,
  UpdateOneOptions,
} from '@nestjs-query/core';
import { genSalt, hash } from 'bcrypt';
import { ICreateUser } from '@app/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { createHash, randomBytes } from 'crypto';
import type { EmailVerificationEvent, WelcomeEmailEvent } from './user.events';

@Injectable()
@QueryService(User)
export class UserService extends MongooseQueryService<User> {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @Inject('NOTIFICATIONS_EVENTS')
    private readonly notificationsClient: ClientProxy,
  ) {
    super(userModel);
  }

  async create(createUserInput: ICreateUser): Promise<User> {
    const { token, tokenHash, expiresAt } = this.createVerificationToken();
    const createUserEntity = {
      ...createUserInput,
      refresh_token: null,
      emailVerified: false,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: expiresAt,
    };
    const tempPassword = createUserEntity.password;
    const salt = await genSalt(10);
    // hash the password with the salt
    createUserEntity.password = await hash(createUserEntity.password, salt);
    const user = new this.userModel(createUserEntity);
    await user.save().catch(() => {
      throw new BadRequestException('Email already used');
    });
    this.emitWelcomeEmail(user, tempPassword);
    this.emitVerificationEmail(user, token);
    return user;
  }

  async findByEmail(email: string, withPassword = false): Promise<User | null> {
    return await this.userModel
      .findOne({
        email: email,
      })
      .select(
        withPassword
          ? '+password +emailVerificationTokenHash +emailVerificationExpiresAt'
          : '-password -emailVerificationTokenHash -emailVerificationExpiresAt',
      )
      .exec()
      .then((user) => user?.toObject() || null);
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.userModel
      .find({ _id: { $in: ids } })
      .select('-password')
      .exec();
  }

  async count(filter: Filter<User>): Promise<number> {
    const filterQuery = this.filterQueryBuilder.buildFilterQuery(
      (filter ?? {}) as Filter<User>,
    );
    return this.userModel.countDocuments(filterQuery).exec();
  }

  async updateOne(
    id: string,
    update: DeepPartial<User>,
    opts?: UpdateOneOptions<User>,
  ): Promise<User> {
    let updateDto = update;
    if (update.password) {
      const salt = await genSalt(10);
      updateDto = {
        ...update,
        password: await hash(update.password, salt),
      };
    }
    return super.updateOne(id, updateDto, opts);
  }

  async verifyEmail(token: string): Promise<User> {
    if (!token) {
      throw new RpcException({ status: 400, message: 'Token is required' });
    }
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const user = await this.userModel
      .findOne({
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: { $gte: now },
      })
      .select('+emailVerificationTokenHash +emailVerificationExpiresAt')
      .exec();
    if (!user) {
      throw new RpcException({
        status: 400,
        message: 'Invalid or expired token',
      });
    }

    user.emailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    await user.save();
    return user;
  }

  async resendVerification(userId: string): Promise<User> {
    if (!userId) {
      throw new RpcException({ status: 400, message: 'User id is required' });
    }
    const user = await this.userModel
      .findById(userId)
      .select('+emailVerificationTokenHash +emailVerificationExpiresAt')
      .exec();
    if (!user) {
      throw new RpcException({ status: 404, message: 'User not found' });
    }
    if (user.emailVerified) {
      throw new RpcException({
        status: 400,
        message: 'Email already verified',
      });
    }

    const { token, tokenHash, expiresAt } = this.createVerificationToken();
    user.emailVerificationTokenHash = tokenHash;
    user.emailVerificationExpiresAt = expiresAt;
    await user.save();
    this.emitVerificationEmail(user, token);
    return user;
  }

  private createVerificationToken(): {
    token: string;
    tokenHash: string;
    expiresAt: Date;
  } {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const hours = Math.max(
      1,
      parseInt(process.env.EMAIL_VERIFICATION_TTL_HOURS || '24'),
    );
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    return { token, tokenHash, expiresAt };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private emitVerificationEmail(user: User, token: string): void {
    const baseUrl = process.env.EMAIL_VERIFICATION_URL_BASE || '';
    if (!baseUrl) {
      this.logger.warn('EMAIL_VERIFICATION_URL_BASE is not configured');
      return;
    }
    const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${token}`;
    const tokenHash = this.hashToken(token);
    const payload: EmailVerificationEvent = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      verificationUrl: url,
      eventId: `${user.id}:email-verify:${tokenHash}`,
      occurredAt: new Date().toISOString(),
    };
    void this.notificationsClient
      .emit('user.emailVerification', payload)
      .subscribe({
        error: (error) => {
          this.logger.warn(
            `Failed to emit email verification: ${error instanceof Error ? error.message : String(error)}`,
          );
        },
      });
  }

  private emitWelcomeEmail(user: User, tempPassword: string | undefined): void {
    if (!user.email || !tempPassword) {
      this.logger.warn('Welcome email missing recipient or temp password');
      return;
    }
    const payload: WelcomeEmailEvent = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      tempPassword,
      eventId: `${user.id}:welcome`,
      occurredAt: new Date().toISOString(),
    };
    void this.notificationsClient.emit('user.welcome', payload).subscribe({
      error: (error) => {
        this.logger.warn(
          `Failed to emit welcome email: ${error instanceof Error ? error.message : String(error)}`,
        );
      },
    });
  }
}
