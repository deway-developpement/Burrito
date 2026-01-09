import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import type { AggregateQuery, Filter, Query } from '@nestjs-query/core';
import { GroupForm } from './entities/group-form.entity';
import { GroupFormService } from './group-form.service';

@Controller()
export class GroupFormController {
  constructor(private readonly groupFormService: GroupFormService) {}

  @MessagePattern({ cmd: 'groupForm.query' })
  query(query: Query<GroupForm>) {
    return this.groupFormService.query(query);
  }

  @MessagePattern({ cmd: 'groupForm.findById' })
  findById(id: string) {
    return this.groupFormService.findById(id);
  }

  @MessagePattern({ cmd: 'groupForm.aggregate' })
  aggregate(data: {
    filter: Filter<GroupForm>;
    aggregate: AggregateQuery<GroupForm>;
  }) {
    return this.groupFormService.aggregate(data.filter, data.aggregate);
  }

  @MessagePattern({ cmd: 'groupForm.count' })
  count(query: Filter<GroupForm>) {
    return this.groupFormService.count(query);
  }

  @MessagePattern({ cmd: 'groupForm.getById' })
  getById(id: string) {
    return this.groupFormService.getById(id);
  }

  @MessagePattern({ cmd: 'groupForm.createOne' })
  createOne(dto: Partial<GroupForm>) {
    return this.groupFormService.createOne(dto);
  }

  @MessagePattern({ cmd: 'groupForm.createMany' })
  createMany(dtos: Partial<GroupForm>[]) {
    return this.groupFormService.createMany(dtos);
  }

  @MessagePattern({ cmd: 'groupForm.updateOne' })
  updateOne(data: { id: string; update: Partial<GroupForm> }) {
    return this.groupFormService.updateOne(data.id, data.update);
  }

  @MessagePattern({ cmd: 'groupForm.updateMany' })
  updateMany(data: { filter: Filter<GroupForm>; update: Partial<GroupForm> }) {
    return this.groupFormService.updateMany(data.update, data.filter);
  }

  @MessagePattern({ cmd: 'groupForm.deleteOne' })
  deleteOne(id: string) {
    return this.groupFormService.deleteOne(id);
  }

  @MessagePattern({ cmd: 'groupForm.deleteMany' })
  deleteMany(filter: Filter<GroupForm>) {
    return this.groupFormService.deleteMany(filter);
  }

  @MessagePattern({ cmd: 'groupForm.listByGroup' })
  listByGroup(groupId: string) {
    return this.groupFormService.listByGroup(groupId);
  }

  @MessagePattern({ cmd: 'groupForm.listByGroups' })
  listByGroups(groupIds: string[]) {
    return this.groupFormService.listByGroups(groupIds);
  }

  @MessagePattern({ cmd: 'groupForm.listByForm' })
  listByForm(formId: string) {
    return this.groupFormService.listByForm(formId);
  }

  @MessagePattern({ cmd: 'groupForm.listByForms' })
  listByForms(formIds: string[]) {
    return this.groupFormService.listByForms(formIds);
  }

  @MessagePattern({ cmd: 'groupForm.removeByComposite' })
  removeByComposite(data: { groupId: string; formId: string }) {
    return this.groupFormService.removeByComposite(data);
  }
}
