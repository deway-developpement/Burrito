import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import type { AggregateQuery, Filter, Query } from '@nestjs-query/core';
import { Membership } from './entities/membership.entity';
import { MembershipService } from './membership.service';

@Controller()
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @MessagePattern({ cmd: 'membership.query' })
  query(query: Query<Membership>) {
    return this.membershipService.query(query);
  }

  @MessagePattern({ cmd: 'membership.findById' })
  findById(id: string) {
    return this.membershipService.findById(id);
  }

  @MessagePattern({ cmd: 'membership.aggregate' })
  aggregate(data: {
    filter: Filter<Membership>;
    aggregate: AggregateQuery<Membership>;
  }) {
    return this.membershipService.aggregate(data.filter, data.aggregate);
  }

  @MessagePattern({ cmd: 'membership.count' })
  count(query: Filter<Membership>) {
    return this.membershipService.count(query);
  }

  @MessagePattern({ cmd: 'membership.getById' })
  getById(id: string) {
    return this.membershipService.getById(id);
  }

  @MessagePattern({ cmd: 'membership.createOne' })
  createOne(dto: Partial<Membership>) {
    return this.membershipService.createOne(dto);
  }

  @MessagePattern({ cmd: 'membership.createMany' })
  createMany(dtos: Partial<Membership>[]) {
    return this.membershipService.createMany(dtos);
  }

  @MessagePattern({ cmd: 'membership.updateOne' })
  updateOne(data: { id: string; update: Partial<Membership> }) {
    return this.membershipService.updateOne(data.id, data.update);
  }

  @MessagePattern({ cmd: 'membership.updateMany' })
  updateMany(data: {
    filter: Filter<Membership>;
    update: Partial<Membership>;
  }) {
    return this.membershipService.updateMany(data.update, data.filter);
  }

  @MessagePattern({ cmd: 'membership.deleteOne' })
  deleteOne(id: string) {
    return this.membershipService.deleteOne(id);
  }

  @MessagePattern({ cmd: 'membership.deleteMany' })
  deleteMany(filter: Filter<Membership>) {
    return this.membershipService.deleteMany(filter);
  }

  @MessagePattern({ cmd: 'membership.listByGroup' })
  listByGroup(groupId: string) {
    return this.membershipService.listByGroup(groupId);
  }

  @MessagePattern({ cmd: 'membership.listByGroups' })
  listByGroups(groupIds: string[]) {
    return this.membershipService.listByGroups(groupIds);
  }

  @MessagePattern({ cmd: 'membership.listByMember' })
  listByMember(memberId: string) {
    return this.membershipService.listByMember(memberId);
  }

  @MessagePattern({ cmd: 'membership.listByMembers' })
  listByMembers(memberIds: string[]) {
    return this.membershipService.listByMembers(memberIds);
  }

  @MessagePattern({ cmd: 'membership.removeByComposite' })
  removeByComposite(data: { groupId: string; memberId: string }) {
    return this.membershipService.removeByComposite(data);
  }
}
