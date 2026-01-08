import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import type { AggregateQuery, Filter, Query } from '@nestjs-query/core';
import { Group } from './entities/group.entity';
import { GroupService } from './group.service';

@Controller()
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @MessagePattern({ cmd: 'group.query' })
  query(query: Query<Group>) {
    return this.groupService.query(query);
  }

  @MessagePattern({ cmd: 'group.findById' })
  findById(id: string) {
    return this.groupService.findById(id);
  }

  @MessagePattern({ cmd: 'group.findByIds' })
  findByIds(ids: string[]) {
    return this.groupService.findByIds(ids);
  }

  @MessagePattern({ cmd: 'group.aggregate' })
  aggregate(data: { filter: Filter<Group>; aggregate: AggregateQuery<Group> }) {
    return this.groupService.aggregate(data.filter, data.aggregate);
  }

  @MessagePattern({ cmd: 'group.count' })
  count(query: Filter<Group>) {
    return this.groupService.count(query);
  }

  @MessagePattern({ cmd: 'group.getById' })
  getById(id: string) {
    return this.groupService.getById(id);
  }

  @MessagePattern({ cmd: 'group.createOne' })
  createOne(dto: Partial<Group>) {
    return this.groupService.createOne(dto);
  }

  @MessagePattern({ cmd: 'group.createMany' })
  createMany(dtos: Partial<Group>[]) {
    return this.groupService.createMany(dtos);
  }

  @MessagePattern({ cmd: 'group.updateOne' })
  updateOne(data: { id: string; update: Partial<Group> }) {
    return this.groupService.updateOne(data.id, data.update);
  }

  @MessagePattern({ cmd: 'group.updateMany' })
  updateMany(data: { filter: Filter<Group>; update: Partial<Group> }) {
    return this.groupService.updateMany(data.update, data.filter);
  }

  @MessagePattern({ cmd: 'group.deleteOne' })
  deleteOne(id: string) {
    return this.groupService.deleteOne(id);
  }

  @MessagePattern({ cmd: 'group.deleteMany' })
  deleteMany(filter: Filter<Group>) {
    return this.groupService.deleteMany(filter);
  }
}
