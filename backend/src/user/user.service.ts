import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserInput } from './dto/create-user.input';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import { AuthType } from '../auth/interface/auth.type';
import { MongooseQueryService } from '@nestjs-query/query-mongoose';
import { QueryService } from '@nestjs-query/core';
import { genSalt, hash } from 'bcrypt';

@Injectable()
@QueryService(User)
export class UserService extends MongooseQueryService<User> {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {
    super(userModel);
  }

  async create(createUserInput: CreateUserInput) {
    const createUserEntity = {
      ...createUserInput,
      refresh_token: null,
      userType: AuthType.student,
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

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({
      email: email,
    });
  }
}
