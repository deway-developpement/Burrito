import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QueryService } from '@nestjs-query/core';
import { MongooseQueryService } from '@nestjs-query/query-mongoose';
import { RpcException } from '@nestjs/microservices';
import { GroupForm } from './entities/group-form.entity';

@Injectable()
@QueryService(GroupForm)
export class GroupFormService extends MongooseQueryService<GroupForm> {
  constructor(
    @InjectModel(GroupForm.name)
    private readonly groupFormModel: Model<GroupForm>,
  ) {
    super(groupFormModel);
  }

  async createOne(dto: Partial<GroupForm>): Promise<GroupForm> {
    try {
      return await super.createOne(dto);
    } catch (error) {
      this.handleDuplicateKey(error);
      throw error;
    }
  }

  async createMany(dtos: Partial<GroupForm>[]): Promise<GroupForm[]> {
    try {
      return await super.createMany(dtos);
    } catch (error) {
      this.handleDuplicateKey(error);
      throw error;
    }
  }

  async listByGroup(groupId: string): Promise<GroupForm[]> {
    const groupForms = await this.groupFormModel.find({ groupId }).exec();
    return groupForms;
  }

  async listByGroups(groupIds: string[]): Promise<GroupForm[]> {
    if (groupIds.length === 0) {
      return [];
    }
    const groupForms = await this.groupFormModel
      .find({ groupId: { $in: groupIds } })
      .exec();
    return groupForms;
  }

  async listByForm(formId: string): Promise<GroupForm[]> {
    const groupForms = await this.groupFormModel.find({ formId }).exec();
    return groupForms;
  }

  async listByForms(formIds: string[]): Promise<GroupForm[]> {
    if (formIds.length === 0) {
      return [];
    }
    const groupForms = await this.groupFormModel
      .find({ formId: { $in: formIds } })
      .exec();
    return groupForms;
  }

  async removeByComposite(data: {
    groupId: string;
    formId: string;
  }): Promise<boolean> {
    const result = await this.groupFormModel
      .deleteOne({
        groupId: data.groupId,
        formId: data.formId,
      })
      .exec();
    if ((result?.deletedCount ?? 0) > 0) {
      return true;
    }

    return false;
  }

  private handleDuplicateKey(error: unknown) {
    if ((error as { code?: number })?.code === 11000) {
      throw new RpcException({ status: 409, message: 'Duplicate key error' });
    }
  }
}
