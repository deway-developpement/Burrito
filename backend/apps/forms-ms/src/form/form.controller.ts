// apps/forms-ms/src/form/form.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import type { Filter, Query } from '@nestjs-query/core';
import { Form } from './entities/form.entity';
import { FormService } from './form.service';

@Controller()
export class FormController {
  constructor(private readonly formService: FormService) {}

  @MessagePattern({ cmd: 'form.query' })
  query(query: Query<Form>) {
    return this.formService.query(query);
  }

  @MessagePattern({ cmd: 'form.findById' })
  findById(id: string) {
    return this.formService.findById(id);
  }

  @MessagePattern({ cmd: 'form.aggregate' })
  aggregate(data: { filter: any; aggregate: any }) {
    return this.formService.aggregate(data.filter, data.aggregate);
  }

  @MessagePattern({ cmd: 'form.count' })
  count(query: any) {
    return this.formService.count(query);
  }

  @MessagePattern({ cmd: 'form.getById' })
  getById(id: string) {
    return this.formService.getById(id);
  }

  @MessagePattern({ cmd: 'form.createOne' })
  createOne(dto: Partial<Form>) {
    return this.formService.createOne(dto);
  }

  @MessagePattern({ cmd: 'form.createMany' })
  createMany(dtos: Partial<Form>[]) {
    return this.formService.createMany(dtos);
  }

  @MessagePattern({ cmd: 'form.updateOne' })
  updateOne(data: { id: string; update: Partial<Form> }) {
    return this.formService.updateOne(data.id, data.update);
  }

  @MessagePattern({ cmd: 'form.updateMany' })
  updateMany(data: { filter: Filter<Form>; update: Partial<Form> }) {
    return this.formService.updateMany(data.update, data.filter);
  }

  @MessagePattern({ cmd: 'form.deleteOne' })
  deleteOne(id: string) {
    return this.formService.deleteOne(id);
  }

  @MessagePattern({ cmd: 'form.deleteMany' })
  deleteMany(filter: any) {
    return this.formService.deleteMany(filter);
  }
}
