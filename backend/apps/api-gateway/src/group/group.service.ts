import { GatewayTimeoutException, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { createRpcClient } from '@app/common';
import {
  AggregateQuery,
  AggregateResponse,
  Class,
  DeleteManyResponse,
  Filter,
  FindRelationOptions,
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
import { MICROSERVICE_TIMEOUT_MS } from '../constants';
import { GroupDto } from './dto/group.dto';
import { CreateGroupInput } from './dto/create-group.input';
import { UpdateGroupInput } from './dto/update-group.input';

@Injectable()
@QueryService(GroupDto)
export class GroupService {
  private readonly groupsClient: ClientProxy;

  constructor(
    @Inject('GROUPS_SERVICE')
    groupsClient: ClientProxy,
  ) {
    this.groupsClient = createRpcClient(groupsClient);
  }

  async query(query: Query<GroupDto>): Promise<GroupDto[]> {
    return this.sendWithTimeout(
      this.groupsClient.send<GroupDto[]>({ cmd: 'group.query' }, query),
    );
  }

  async findById(id: string): Promise<GroupDto | undefined> {
    return this.sendWithTimeout(
      this.groupsClient.send<GroupDto | undefined>(
        { cmd: 'group.findById' },
        id,
      ),
    );
  }

  async findByIds(ids: string[]): Promise<GroupDto[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.sendWithTimeout(
      this.groupsClient.send<GroupDto[]>({ cmd: 'group.findByIds' }, ids),
    );
  }

  async aggregate(
    filter: Filter<GroupDto>,
    query: AggregateQuery<GroupDto>,
  ): Promise<AggregateResponse<GroupDto>[]> {
    return this.sendWithTimeout(
      this.groupsClient.send<AggregateResponse<GroupDto>[]>(
        { cmd: 'group.aggregate' },
        { filter, aggregate: query },
      ),
    );
  }

  async count(query: Filter<GroupDto>): Promise<number> {
    return this.sendWithTimeout(
      this.groupsClient.send<number>({ cmd: 'group.count' }, query),
    );
  }

  queryRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: GroupDto,
    query: Query<Relation>,
  ): Promise<Relation[]>;

  queryRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: GroupDto[],
    query: Query<Relation>,
  ): Promise<Map<GroupDto, Relation[]>>;

  async queryRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtoOrDtos: GroupDto | GroupDto[],
    query: Query<Relation>,
  ): Promise<Relation[] | Map<GroupDto, Relation[]>> {
    return this.sendWithTimeout(
      this.groupsClient.send<Relation[] | Map<GroupDto, Relation[]>>(
        { cmd: 'group.queryRelations' },
        { RelationClass, relationName, dtoOrDtos, query },
      ),
    );
  }

  aggregateRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: GroupDto,
    filter: Filter<Relation>,
    aggregate: AggregateQuery<Relation>,
  ): Promise<AggregateResponse<Relation>[]>;

  aggregateRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: GroupDto[],
    filter: Filter<Relation>,
    aggregate: AggregateQuery<Relation>,
  ): Promise<Map<GroupDto, AggregateResponse<Relation>[]>>;

  async aggregateRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtoOrDtos: GroupDto | GroupDto[],
    filter: Filter<Relation>,
    aggregate: AggregateQuery<Relation>,
  ): Promise<
    AggregateResponse<Relation>[] | Map<GroupDto, AggregateResponse<Relation>[]>
  > {
    return this.sendWithTimeout(
      this.groupsClient.send<
        | AggregateResponse<Relation>[]
        | Map<GroupDto, AggregateResponse<Relation>[]>
      >(
        { cmd: 'group.aggregateRelations' },
        { RelationClass, relationName, dtoOrDtos, filter, aggregate },
      ),
    );
  }

  countRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: GroupDto,
    query: Filter<Relation>,
  ): Promise<number>;

  countRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: GroupDto[],
    query: Filter<Relation>,
  ): Promise<Map<GroupDto, number>>;

  async countRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtoOrDtos: GroupDto | GroupDto[],
    query: Filter<Relation>,
  ): Promise<number | Map<GroupDto, number>> {
    return this.sendWithTimeout(
      this.groupsClient.send<number | Map<GroupDto, number>>(
        { cmd: 'group.countRelations' },
        { RelationClass, relationName, dtoOrDtos, query },
      ),
    );
  }

  findRelation<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: GroupDto,
    opts?: FindRelationOptions<Relation>,
  ): Promise<Relation | undefined>;

  findRelation<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: GroupDto[],
    opts?: FindRelationOptions<Relation>,
  ): Promise<Map<GroupDto, Relation | undefined>>;

  async findRelation<Relation>(
    RelationClass: new () => Relation,
    relationName: string,
    dtoOrDtos: GroupDto | GroupDto[],
  ): Promise<Relation | undefined | Map<GroupDto, Relation | undefined>> {
    return this.sendWithTimeout(
      this.groupsClient.send<
        Relation | undefined | Map<GroupDto, Relation | undefined>
      >(
        { cmd: 'group.findRelation' },
        { RelationClass, relationName, dtoOrDtos },
      ),
    );
  }

  async addRelations<Relation>(
    relationName: string,
    id: string | number,
    relationIds: (string | number)[],
    opts?: ModifyRelationOptions<GroupDto, Relation>,
  ): Promise<GroupDto> {
    return this.sendWithTimeout(
      this.groupsClient.send<GroupDto>(
        { cmd: 'group.addRelations' },
        { relationName, id, relationIds, opts },
      ),
    );
  }

  async setRelation<Relation>(
    relationName: string,
    id: string | number,
    relationId: string,
    opts?: ModifyRelationOptions<GroupDto, Relation>,
  ): Promise<GroupDto> {
    return this.sendWithTimeout(
      this.groupsClient.send<GroupDto>(
        { cmd: 'group.setRelation' },
        { relationName, id, relationId, opts },
      ),
    );
  }

  async setRelations<Relation>(
    relationName: string,
    id: string | number,
    relationIds: (string | number)[],
    opts?: ModifyRelationOptions<GroupDto, Relation>,
  ): Promise<GroupDto> {
    return this.sendWithTimeout(
      this.groupsClient.send<GroupDto>(
        { cmd: 'group.setRelations' },
        { relationName, id, relationIds, opts },
      ),
    );
  }

  async removeRelation<Relation>(
    relationName: string,
    id: string | number,
    relationId: string | number,
    opts?: ModifyRelationOptions<GroupDto, Relation>,
  ): Promise<GroupDto> {
    return this.sendWithTimeout(
      this.groupsClient.send<GroupDto>(
        { cmd: 'group.removeRelation' },
        { relationName, id, relationId, opts },
      ),
    );
  }

  async removeRelations<Relation>(
    relationName: string,
    id: string | number,
    relationIds: (string | number)[],
    opts?: ModifyRelationOptions<GroupDto, Relation>,
  ): Promise<GroupDto> {
    return this.sendWithTimeout(
      this.groupsClient.send<GroupDto>(
        { cmd: 'group.removeRelations' },
        { relationName, id, relationIds, opts },
      ),
    );
  }

  async getById(id: string): Promise<GroupDto> {
    return this.sendWithTimeout(
      this.groupsClient.send<GroupDto>({ cmd: 'group.getById' }, id),
    );
  }

  async createOne(dto: CreateGroupInput): Promise<GroupDto> {
    return this.sendWithTimeout(
      this.groupsClient.send<GroupDto>({ cmd: 'group.createOne' }, dto),
    );
  }

  async createMany(dtos: CreateGroupInput[]): Promise<GroupDto[]> {
    return this.sendWithTimeout(
      this.groupsClient.send<GroupDto[]>({ cmd: 'group.createMany' }, dtos),
    );
  }

  async updateOne(id: string, update: UpdateGroupInput): Promise<GroupDto> {
    return this.sendWithTimeout(
      this.groupsClient.send<GroupDto>(
        { cmd: 'group.updateOne' },
        { id, update },
      ),
    );
  }

  async updateMany(
    update: UpdateGroupInput,
    filter: Filter<GroupDto>,
  ): Promise<UpdateManyResponse> {
    return this.sendWithTimeout(
      this.groupsClient.send<UpdateManyResponse>(
        { cmd: 'group.updateMany' },
        { update, filter },
      ),
    );
  }

  async deleteOne(id: string): Promise<GroupDto> {
    return this.sendWithTimeout(
      this.groupsClient.send<GroupDto>({ cmd: 'group.deleteOne' }, id),
    );
  }

  async deleteMany(filter: Filter<GroupDto>): Promise<DeleteManyResponse> {
    return this.sendWithTimeout(
      this.groupsClient.send<DeleteManyResponse>(
        { cmd: 'group.deleteMany' },
        filter,
      ),
    );
  }

  private async sendWithTimeout<T>(observable: Observable<T>): Promise<T> {
    return firstValueFrom(
      observable.pipe(
        timeout(MICROSERVICE_TIMEOUT_MS),
        catchError((err) => {
          if (err instanceof TimeoutError) {
            throw new GatewayTimeoutException('Groups service timed out');
          }
          throw err;
        }),
      ),
    );
  }
}
