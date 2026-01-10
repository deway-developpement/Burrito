import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import type { AggregateQuery, Filter, Query } from '@nestjs-query/core';
import { Evaluation } from './entities/evaluation.entity';
import { EvaluationService } from './evaluation.service';
import { RpcToHttpFilter } from '@app/common';

@UseFilters(RpcToHttpFilter)
@Controller()
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @MessagePattern({ cmd: 'evaluation.query' })
  query(query: Query<Evaluation>) {
    return this.evaluationService.query(query);
  }

  @MessagePattern({ cmd: 'evaluation.findById' })
  findById(id: string) {
    return this.evaluationService.findById(id);
  }

  @MessagePattern({ cmd: 'evaluation.aggregate' })
  aggregate(data: {
    filter: Filter<Evaluation>;
    aggregate: AggregateQuery<Evaluation>;
  }) {
    return this.evaluationService.aggregate(data.filter, data.aggregate);
  }

  @MessagePattern({ cmd: 'evaluation.count' })
  count(query: Filter<Evaluation>) {
    return this.evaluationService.count(query);
  }

  @MessagePattern({ cmd: 'evaluation.getById' })
  getById(id: string) {
    return this.evaluationService.getById(id);
  }

  @MessagePattern({ cmd: 'evaluation.createOne' })
  createOne(dto: Partial<Evaluation>) {
    return this.evaluationService.createOne(dto);
  }

  @MessagePattern({ cmd: 'evaluation.createMany' })
  createMany(dtos: Partial<Evaluation>[]) {
    return this.evaluationService.createMany(dtos);
  }

  @MessagePattern({ cmd: 'evaluation.updateOne' })
  updateOne(data: { id: string; update: Partial<Evaluation> }) {
    return this.evaluationService.updateOne(data.id, data.update);
  }

  @MessagePattern({ cmd: 'evaluation.updateMany' })
  updateMany(data: {
    filter: Filter<Evaluation>;
    update: Partial<Evaluation>;
  }) {
    return this.evaluationService.updateMany(data.update, data.filter);
  }

  @MessagePattern({ cmd: 'evaluation.deleteOne' })
  deleteOne(id: string) {
    return this.evaluationService.deleteOne(id);
  }

  @MessagePattern({ cmd: 'evaluation.deleteMany' })
  deleteMany(filter: Filter<Evaluation>) {
    return this.evaluationService.deleteMany(filter);
  }

  @MessagePattern({ cmd: 'evaluation.userRespondedToForm' })
  userRespondedToForm(data: {
    formId: string;
    userId: string;
  }): Promise<boolean> {
    return this.evaluationService.userRespondedToForm(data.formId, data.userId);
  }
}
