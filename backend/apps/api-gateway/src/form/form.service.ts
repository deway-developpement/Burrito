import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  QueryService,
  Query,
  AggregateQuery,
  AggregateResponse,
  Class,
  ModifyRelationOptions,
  Filter,
  UpdateManyResponse,
  DeleteManyResponse,
} from '@nestjs-query/core';
import { firstValueFrom } from 'rxjs';
import { FormDto } from './dto/form.dto';
import { CreateFormInput } from './dto/create-form.input';
import { UpdateFormInput } from './dto/update-form.input';

@Injectable()
@QueryService<FormDto>(FormDto)
export class FormService {
  constructor(
    @Inject('FORM_SERVICE') private readonly formClient: ClientProxy,
  ) {}

  // === READ APIs ===

  async query(query: Query<FormDto>): Promise<FormDto[]> {
    return firstValueFrom(
      this.formClient.send<FormDto[]>({ cmd: 'form.query' }, query),
    );
  }

  async findById(id: string): Promise<FormDto | undefined> {
    return firstValueFrom(
      this.formClient.send<FormDto | undefined>({ cmd: 'form.findById' }, id),
    );
  }

  async aggregate(
    filter: Filter<FormDto>,
    query: AggregateQuery<FormDto>,
  ): Promise<AggregateResponse<FormDto>[]> {
    return firstValueFrom(
      this.formClient.send<AggregateResponse<FormDto>[]>(
        { cmd: 'form.aggregate' },
        { filter, aggregate: query },
      ),
    );
  }

  async count(query: Filter<FormDto>): Promise<number> {
    return firstValueFrom(
      this.formClient.send<number>({ cmd: 'form.count' }, query),
    );
  }

  queryRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: FormDto,
    query: Query<Relation>,
  ): Promise<Relation[]>;

  queryRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: FormDto[],
    query: Query<Relation>,
  ): Promise<Map<FormDto, Relation[]>>;

  async queryRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtoOrDtos: FormDto | FormDto[],
    query: Query<Relation>,
  ): Promise<Relation[] | Map<FormDto, Relation[]>> {
    return firstValueFrom(
      this.formClient.send<Relation[] | Map<FormDto, Relation[]>>(
        { cmd: 'form.queryRelations' },
        { RelationClass, relationName, dtoOrDtos, query },
      ),
    );
  }

  aggregateRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: FormDto,
    filter: Filter<Relation>,
    aggregate: AggregateQuery<Relation>,
  ): Promise<AggregateResponse<Relation>[]>;

  aggregateRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: FormDto[],
    filter: Filter<Relation>,
    aggregate: AggregateQuery<Relation>,
  ): Promise<Map<FormDto, AggregateResponse<Relation>[]>>;

  async aggregateRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtoOrDtos: FormDto | FormDto[],
    filter: Filter<Relation>,
    aggregate: AggregateQuery<Relation>,
  ): Promise<
    AggregateResponse<Relation>[] | Map<FormDto, AggregateResponse<Relation>[]>
  > {
    return firstValueFrom(
      this.formClient.send<
        | AggregateResponse<Relation>[]
        | Map<FormDto, AggregateResponse<Relation>[]>
      >(
        { cmd: 'form.aggregateRelations' },
        { RelationClass, relationName, dtoOrDtos, filter, aggregate },
      ),
    );
  }

  countRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: FormDto,
    query: Filter<Relation>,
  ): Promise<number>;

  countRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: FormDto[],
    query: Filter<Relation>,
  ): Promise<Map<FormDto, number>>;

  async countRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtoOrDtos: FormDto | FormDto[],
    query: Filter<Relation>,
  ): Promise<number | Map<FormDto, number>> {
    return firstValueFrom(
      this.formClient.send<number | Map<FormDto, number>>(
        { cmd: 'form.countRelations' },
        { RelationClass, relationName, dtoOrDtos, query },
      ),
    );
  }

  findRelation<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: FormDto,
  ): Promise<Relation>;

  findRelation<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: FormDto[],
  ): Promise<Map<FormDto, Relation>>;

  async findRelation<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtoOrDtos: FormDto | FormDto[],
  ): Promise<Relation | Map<FormDto, Relation>> {
    return firstValueFrom(
      this.formClient.send<Relation | Map<FormDto, Relation>>(
        { cmd: 'form.findRelation' },
        { RelationClass, relationName, dtoOrDtos },
      ),
    );
  }

  async addRelations<Relation>(
    relationName: string,
    id: string | number,
    relationIds: (string | number)[],
    opts?: ModifyRelationOptions<FormDto, Relation>,
  ): Promise<FormDto> {
    return firstValueFrom(
      this.formClient.send<FormDto>(
        { cmd: 'form.addRelations' },
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
    opts?: ModifyRelationOptions<FormDto, Relation>,
  ): Promise<FormDto> {
    return firstValueFrom(
      this.formClient.send<FormDto>(
        { cmd: 'form.setRelations' },
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
    opts?: ModifyRelationOptions<FormDto, Relation>,
  ): Promise<FormDto> {
    return firstValueFrom(
      this.formClient.send<FormDto>(
        { cmd: 'form.setRelations' },
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
    opts?: ModifyRelationOptions<FormDto, Relation>,
  ): Promise<FormDto> {
    return firstValueFrom(
      this.formClient.send<FormDto>(
        { cmd: 'form.removeRelation' },
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
    opts?: ModifyRelationOptions<FormDto, Relation>,
  ): Promise<FormDto> {
    return firstValueFrom(
      this.formClient.send<FormDto>(
        { cmd: 'form.removeRelations' },
        {
          relationName,
          id,
          relationIds,
          opts,
        },
      ),
    );
  }

  async getById(id: string): Promise<FormDto> {
    return firstValueFrom(
      this.formClient.send<FormDto>({ cmd: 'form.getById' }, id),
    );
  }

  // === WRITE APIs (used by CRUDResolver for mutations) ===

  async createOne(dto: CreateFormInput): Promise<FormDto> {
    return firstValueFrom(
      this.formClient.send<FormDto>({ cmd: 'form.createOne' }, dto),
    );
  }

  async createMany(dtos: CreateFormInput[]): Promise<FormDto[]> {
    return firstValueFrom(
      this.formClient.send<FormDto[]>({ cmd: 'form.createMany' }, dtos),
    );
  }

  async updateOne(id: string, update: UpdateFormInput): Promise<FormDto> {
    return firstValueFrom(
      this.formClient.send<FormDto>({ cmd: 'form.updateOne' }, { id, update }),
    );
  }

  async updateMany(
    update: UpdateFormInput,
    filter: Filter<FormDto>,
  ): Promise<UpdateManyResponse> {
    return firstValueFrom(
      this.formClient.send<UpdateManyResponse>(
        { cmd: 'form.updateMany' },
        { update, filter },
      ),
    );
  }

  async deleteOne(id: string): Promise<FormDto> {
    return firstValueFrom(
      this.formClient.send<FormDto>({ cmd: 'form.deleteOne' }, id),
    );
  }

  async deleteMany(filter: Filter<FormDto>): Promise<DeleteManyResponse> {
    return firstValueFrom(
      this.formClient.send<DeleteManyResponse>(
        { cmd: 'form.deleteMany' },
        filter,
      ),
    );
  }
}
