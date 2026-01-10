import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QueryService } from '@nestjs-query/core';
import { MongooseQueryService } from '@nestjs-query/query-mongoose';
import { Group } from './entities/group.entity';

@Injectable()
@QueryService(Group)
export class GroupService extends MongooseQueryService<Group> {
  constructor(@InjectModel(Group.name) private readonly groupModel: Model<Group>) {
    super(groupModel);
  }

  async findByIds(ids: string[]): Promise<Group[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.groupModel.find({ _id: { $in: ids } }).exec();
  }
}
