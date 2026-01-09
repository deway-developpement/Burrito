import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import { MongooseQueryService } from '@nestjs-query/query-mongoose';
import {
  DeepPartial,
  QueryService,
  UpdateOneOptions,
} from '@nestjs-query/core';
import { genSalt, hash } from 'bcrypt';
import { ICreateUser } from '@app/common';

@Injectable()
@QueryService(User)
export class UserService extends MongooseQueryService<User> {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {
    super(userModel);
  }

  async create(createUserInput: ICreateUser): Promise<User> {
    const createUserEntity = {
      ...createUserInput,
      refresh_token: null,
    };
    const salt = await genSalt(10);
    // hash the password with the salt
    createUserEntity.password = await hash(createUserEntity.password, salt);
    const user = new this.userModel(createUserEntity);
    await user.save().catch(() => {
      throw new BadRequestException('Email already used');
    });
    return user;
  }

  async findByEmail(email: string, withPassword = false): Promise<User | null> {
    return await this.userModel
      .findOne({
        email: email,
      })
      .select(withPassword ? '+password' : '-password')
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
}
