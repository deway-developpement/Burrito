import { GatewayTimeoutException, Inject, Injectable } from '@nestjs/common';
import { MICROSERVICE_TIMEOUT_MS } from '../constants';
import { ClientProxy } from '@nestjs/microservices';
import { createRpcClient } from '@app/common';
import {
  AggregateQuery,
  AggregateResponse,
  Class,
  DeleteManyResponse,
  Filter,
  ModifyRelationOptions,
  Query,
  QueryService,
  UpdateManyResponse,
} from '@nestjs-query/core';
import {
  Observable,
  TimeoutError,
  catchError,
  firstValueFrom,
  timeout,
} from 'rxjs';
import { EvaluationDto } from './dto/evaluation.dto';
import { CreateEvaluationInput } from './dto/create-evaluation.input';
import { UpdateEvaluationInput } from './dto/update-evaluation.input';

@Injectable()
@QueryService(EvaluationDto)
export class EvaluationService {
  private readonly evaluationClient: ClientProxy;

  constructor(
    @Inject('EVALUATION_SERVICE')
    evaluationClient: ClientProxy,
  ) {
    this.evaluationClient = createRpcClient(evaluationClient);
  }

  // === READ APIs ===

  async query(query: Query<EvaluationDto>): Promise<EvaluationDto[]> {
    return this.sendWithTimeout(
      this.evaluationClient.send<EvaluationDto[]>(
        { cmd: 'evaluation.query' },
        query,
      ),
    );
  }

  async findById(id: string): Promise<EvaluationDto | undefined> {
    return this.sendWithTimeout(
      this.evaluationClient.send<EvaluationDto | undefined>(
        { cmd: 'evaluation.findById' },
        id,
      ),
    );
  }

  async aggregate(
    filter: Filter<EvaluationDto>,
    query: AggregateQuery<EvaluationDto>,
  ): Promise<AggregateResponse<EvaluationDto>[]> {
    return this.sendWithTimeout(
      this.evaluationClient.send<AggregateResponse<EvaluationDto>[]>(
        { cmd: 'evaluation.aggregate' },
        { filter, aggregate: query },
      ),
    );
  }

  async count(query: Filter<EvaluationDto>): Promise<number> {
    return this.sendWithTimeout(
      this.evaluationClient.send<number>({ cmd: 'evaluation.count' }, query),
    );
  }

  queryRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: EvaluationDto,
    query: Query<Relation>,
  ): Promise<Relation[]>;

  queryRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: EvaluationDto[],
    query: Query<Relation>,
  ): Promise<Map<EvaluationDto, Relation[]>>;

  async queryRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtoOrDtos: EvaluationDto | EvaluationDto[],
    query: Query<Relation>,
  ): Promise<Relation[] | Map<EvaluationDto, Relation[]>> {
    return this.sendWithTimeout(
      this.evaluationClient.send<Relation[] | Map<EvaluationDto, Relation[]>>(
        { cmd: 'evaluation.queryRelations' },
        { RelationClass, relationName, dtoOrDtos, query },
      ),
    );
  }

  aggregateRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: EvaluationDto,
    filter: Filter<Relation>,
    aggregate: AggregateQuery<Relation>,
  ): Promise<AggregateResponse<Relation>[]>;

  aggregateRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: EvaluationDto[],
    filter: Filter<Relation>,
    aggregate: AggregateQuery<Relation>,
  ): Promise<Map<EvaluationDto, AggregateResponse<Relation>[]>>;

  async aggregateRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtoOrDtos: EvaluationDto | EvaluationDto[],
    filter: Filter<Relation>,
    aggregate: AggregateQuery<Relation>,
  ): Promise<
    | AggregateResponse<Relation>[]
    | Map<EvaluationDto, AggregateResponse<Relation>[]>
  > {
    return this.sendWithTimeout(
      this.evaluationClient.send<
        | AggregateResponse<Relation>[]
        | Map<EvaluationDto, AggregateResponse<Relation>[]>
      >(
        { cmd: 'evaluation.aggregateRelations' },
        { RelationClass, relationName, dtoOrDtos, filter, aggregate },
      ),
    );
  }

  countRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: EvaluationDto,
    query: Filter<Relation>,
  ): Promise<number>;

  countRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: EvaluationDto[],
    query: Filter<Relation>,
  ): Promise<Map<EvaluationDto, number>>;

  async countRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtoOrDtos: EvaluationDto | EvaluationDto[],
    query: Filter<Relation>,
  ): Promise<number | Map<EvaluationDto, number>> {
    return this.sendWithTimeout(
      this.evaluationClient.send<number | Map<EvaluationDto, number>>(
        { cmd: 'evaluation.countRelations' },
        { RelationClass, relationName, dtoOrDtos, query },
      ),
    );
  }

  findRelation<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: EvaluationDto,
  ): Promise<Relation>;

  findRelation<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: EvaluationDto[],
  ): Promise<Map<EvaluationDto, Relation>>;

  async findRelation<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtoOrDtos: EvaluationDto | EvaluationDto[],
  ): Promise<Relation | Map<EvaluationDto, Relation>> {
    return this.sendWithTimeout(
      this.evaluationClient.send<Relation | Map<EvaluationDto, Relation>>(
        { cmd: 'evaluation.findRelation' },
        { RelationClass, relationName, dtoOrDtos },
      ),
    );
  }

  async addRelations<Relation>(
    relationName: string,
    id: string | number,
    relationIds: (string | number)[],
    opts?: ModifyRelationOptions<EvaluationDto, Relation>,
  ): Promise<EvaluationDto> {
    return this.sendWithTimeout(
      this.evaluationClient.send<EvaluationDto>(
        { cmd: 'evaluation.addRelations' },
        {
          relationName,
          id,
          relationIds,
          opts,
        },
      ),
    );
  }

  async setRelation<Relation>(
    relationName: string,
    id: string | number,
    relationId: string,
    opts?: ModifyRelationOptions<EvaluationDto, Relation>,
  ): Promise<EvaluationDto> {
    return this.sendWithTimeout(
      this.evaluationClient.send<EvaluationDto>(
        { cmd: 'evaluation.setRelations' },
        {
          relationName,
          id,
          relationId,
          opts,
        },
      ),
    );
  }

  async setRelations<Relation>(
    relationName: string,
    id: string | number,
    relationIds: (string | number)[],
    opts?: ModifyRelationOptions<EvaluationDto, Relation>,
  ): Promise<EvaluationDto> {
    return this.sendWithTimeout(
      this.evaluationClient.send<EvaluationDto>(
        { cmd: 'evaluation.setRelations' },
        {
          relationName,
          id,
          relationIds,
          opts,
        },
      ),
    );
  }

  async removeRelation<Relation>(
    relationName: string,
    id: string | number,
    relationId: string | number,
    opts?: ModifyRelationOptions<EvaluationDto, Relation>,
  ): Promise<EvaluationDto> {
    return this.sendWithTimeout(
      this.evaluationClient.send<EvaluationDto>(
        { cmd: 'evaluation.removeRelation' },
        {
          relationName,
          id,
          relationId,
          opts,
        },
      ),
    );
  }

  async removeRelations<Relation>(
    relationName: string,
    id: string | number,
    relationIds: (string | number)[],
    opts?: ModifyRelationOptions<EvaluationDto, Relation>,
  ): Promise<EvaluationDto> {
    return this.sendWithTimeout(
      this.evaluationClient.send<EvaluationDto>(
        { cmd: 'evaluation.removeRelations' },
        {
          relationName,
          id,
          relationIds,
          opts,
        },
      ),
    );
  }

  async getById(id: string): Promise<EvaluationDto> {
    return this.sendWithTimeout(
      this.evaluationClient.send<EvaluationDto>(
        { cmd: 'evaluation.getById' },
        id,
      ),
    );
  }

  // === WRITE APIs (used by CRUDResolver for mutations) ===

  async createOne(dto: CreateEvaluationInput): Promise<EvaluationDto> {
    return this.sendWithTimeout(
      this.evaluationClient.send<EvaluationDto>(
        { cmd: 'evaluation.createOne' },
        dto,
      ),
    );
  }

  async createMany(dtos: CreateEvaluationInput[]): Promise<EvaluationDto[]> {
    return this.sendWithTimeout(
      this.evaluationClient.send<EvaluationDto[]>(
        { cmd: 'evaluation.createMany' },
        dtos,
      ),
    );
  }

  async updateOne(
    id: string,
    update: UpdateEvaluationInput,
  ): Promise<EvaluationDto> {
    return this.sendWithTimeout(
      this.evaluationClient.send<EvaluationDto>(
        { cmd: 'evaluation.updateOne' },
        { id, update },
      ),
    );
  }

  async updateMany(
    update: UpdateEvaluationInput,
    filter: Filter<EvaluationDto>,
  ): Promise<UpdateManyResponse> {
    return this.sendWithTimeout(
      this.evaluationClient.send<UpdateManyResponse>(
        { cmd: 'evaluation.updateMany' },
        { update, filter },
      ),
    );
  }

  async deleteOne(id: string): Promise<EvaluationDto> {
    return this.sendWithTimeout(
      this.evaluationClient.send<EvaluationDto>(
        { cmd: 'evaluation.deleteOne' },
        id,
      ),
    );
  }

  async deleteMany(filter: Filter<EvaluationDto>): Promise<DeleteManyResponse> {
    return this.sendWithTimeout(
      this.evaluationClient.send<DeleteManyResponse>(
        { cmd: 'evaluation.deleteMany' },
        filter,
      ),
    );
  }

  async userRespondedToForm(formId: string, userId: string): Promise<boolean> {
    return this.sendWithTimeout(
      this.evaluationClient.send<boolean>(
        { cmd: 'evaluation.userRespondedToForm' },
        { formId, userId },
      ),
    );
  }

  private async sendWithTimeout<T>(observable: Observable<T>): Promise<T> {
    return firstValueFrom(
      observable.pipe(
        timeout(MICROSERVICE_TIMEOUT_MS),
        catchError((err) => {
          if (err instanceof TimeoutError) {
            throw new GatewayTimeoutException('Evaluation service timed out');
          }
          throw err;
        }),
      ),
    );
  }
}
