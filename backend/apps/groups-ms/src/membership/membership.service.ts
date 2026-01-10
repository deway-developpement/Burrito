import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QueryService } from '@nestjs-query/core';
import { MongooseQueryService } from '@nestjs-query/query-mongoose';
import { RpcException } from '@nestjs/microservices';
import { Membership } from './entities/membership.entity';

@Injectable()
@QueryService(Membership)
export class MembershipService extends MongooseQueryService<Membership> {
  constructor(
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<Membership>,
  ) {
    super(membershipModel);
  }

  async createOne(dto: Partial<Membership>): Promise<Membership> {
    try {
      return await super.createOne(dto);
    } catch (error) {
      this.handleDuplicateKey(error);
      throw error;
    }
  }

  async createMany(dtos: Partial<Membership>[]): Promise<Membership[]> {
    try {
      return await super.createMany(dtos);
    } catch (error) {
      this.handleDuplicateKey(error);
      throw error;
    }
  }

  async listByGroup(groupId: string): Promise<Membership[]> {
    const memberships = await this.membershipModel.find({ groupId }).exec();
    return memberships;
  }

  async listByGroups(groupIds: string[]): Promise<Membership[]> {
    if (groupIds.length === 0) {
      return [];
    }
    const memberships = await this.membershipModel
      .find({ groupId: { $in: groupIds } })
      .exec();
    return memberships;
  }

  async listByMember(memberId: string): Promise<Membership[]> {
    const memberships = await this.membershipModel.find({ memberId }).exec();
    return memberships;
  }

  async listByMembers(memberIds: string[]): Promise<Membership[]> {
    if (memberIds.length === 0) {
      return [];
    }

    const memberships = await this.membershipModel
      .find({ memberId: { $in: memberIds } })
      .exec();

    return memberships;
  }

  async removeByComposite(data: {
    groupId: string;
    memberId: string;
  }): Promise<boolean> {
    const result = await this.membershipModel
      .deleteOne({
        groupId: data.groupId,
        memberId: data.memberId,
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
