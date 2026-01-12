import {
  BadRequestException,
  GatewayTimeoutException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { MICROSERVICE_TIMEOUT_MS } from '../constants';
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
import {
  Observable,
  TimeoutError,
  catchError,
  firstValueFrom,
  timeout,
} from 'rxjs';
import { FormDto } from './dto/form.dto';
import { CreateFormInput } from './dto/create-form.input';
import { UpdateFormInput } from './dto/update-form.input';
import { FormStatus, UserType } from '@app/common';
import { UserService } from '../user/user.service';

@Injectable()
@QueryService<FormDto>(FormDto)
export class FormService {
  constructor(
    @Inject('FORM_SERVICE') private readonly formClient: ClientProxy,
    private readonly userService: UserService,
  ) {}

  // === READ APIs ===

  async query(query: Query<FormDto>): Promise<FormDto[]> {
    return this.sendWithTimeout(
      this.formClient.send<FormDto[]>({ cmd: 'form.query' }, query),
    );
  }

  async findById(id: string): Promise<FormDto | undefined> {
    return this.sendWithTimeout(
      this.formClient.send<FormDto | undefined>({ cmd: 'form.findById' }, id),
    );
  }

  async findByIds(ids: string[]): Promise<FormDto[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.sendWithTimeout(
      this.formClient.send<FormDto[]>({ cmd: 'form.findByIds' }, ids),
    );
  }

  async aggregate(
    filter: Filter<FormDto>,
    query: AggregateQuery<FormDto>,
  ): Promise<AggregateResponse<FormDto>[]> {
    return this.sendWithTimeout(
      this.formClient.send<AggregateResponse<FormDto>[]>(
        { cmd: 'form.aggregate' },
        { filter, aggregate: query },
      ),
    );
  }

  async count(query: Filter<FormDto>): Promise<number> {
    return this.sendWithTimeout(
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
    return this.sendWithTimeout(
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
    return this.sendWithTimeout(
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
    return this.sendWithTimeout(
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
    return this.sendWithTimeout(
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
    return this.sendWithTimeout(
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
    return this.sendWithTimeout(
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
    return this.sendWithTimeout(
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
    return this.sendWithTimeout(
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
    return this.sendWithTimeout(
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
    return this.sendWithTimeout(
      this.formClient.send<FormDto>({ cmd: 'form.getById' }, id),
    );
  }

  // === WRITE APIs (used by CRUDResolver for mutations) ===

  async createOne(dto: CreateFormInput): Promise<FormDto> {
    await this.ensureTeacherIds(
      dto.targetTeacherId ? [dto.targetTeacherId] : [],
    );
    return this.sendWithTimeout(
      this.formClient.send<FormDto>({ cmd: 'form.createOne' }, dto),
    );
  }

  async createMany(dtos: CreateFormInput[]): Promise<FormDto[]> {
    const teacherIds = dtos
      .map((dto) => dto.targetTeacherId)
      .filter((teacherId): teacherId is string => Boolean(teacherId));
    await this.ensureTeacherIds(teacherIds);
    return this.sendWithTimeout(
      this.formClient.send<FormDto[]>({ cmd: 'form.createMany' }, dtos),
    );
  }

  async updateOne(id: string, update: UpdateFormInput): Promise<FormDto> {
    await this.ensureTeacherIds(
      update.targetTeacherId ? [update.targetTeacherId] : [],
    );
    return this.sendWithTimeout(
      this.formClient.send<FormDto>({ cmd: 'form.updateOne' }, { id, update }),
    );
  }

  async changeStatus(id: string, status: FormStatus): Promise<FormDto> {
    return this.sendWithTimeout(
      this.formClient.send<FormDto>(
        { cmd: 'form.updateOne' },
        { id, update: { status } },
      ),
    );
  }

  async updateMany(
    update: UpdateFormInput,
    filter: Filter<FormDto>,
  ): Promise<UpdateManyResponse> {
    await this.ensureTeacherIds(
      update.targetTeacherId ? [update.targetTeacherId] : [],
    );
    return this.sendWithTimeout(
      this.formClient.send<UpdateManyResponse>(
        { cmd: 'form.updateMany' },
        { update, filter },
      ),
    );
  }

  async deleteOne(id: string): Promise<FormDto> {
    return this.sendWithTimeout(
      this.formClient.send<FormDto>({ cmd: 'form.deleteOne' }, id),
    );
  }

  async deleteMany(filter: Filter<FormDto>): Promise<DeleteManyResponse> {
    return this.sendWithTimeout(
      this.formClient.send<DeleteManyResponse>(
        { cmd: 'form.deleteMany' },
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
            throw new GatewayTimeoutException('Form service timed out');
          }
          const status =
            (err as { status?: number })?.status ??
            (err as { error?: { status?: number } })?.error?.status;
          if (status === 400) {
            const message =
              (err as { message?: string })?.message ??
              (err as { error?: { message?: string } })?.error?.message ??
              'Invalid form data';
            throw new BadRequestException(message);
          }
          throw err;
        }),
      ),
    );
  }

  private async ensureTeacherIds(teacherIds: string[]): Promise<void> {
    const normalized = Array.from(
      new Set(teacherIds.filter((teacherId) => teacherId.trim() !== '')),
    );
    if (normalized.length === 0) {
      return;
    }
    const invalidFormat = normalized.filter(
      (teacherId) => !isValidObjectId(teacherId),
    );
    if (invalidFormat.length > 0) {
      throw new BadRequestException('targetTeacherId must be a valid user id');
    }
    const users = await this.userService.findByIds(normalized);
    const teacherIdsSet = new Set(
      users
        .filter((user) => user.userType === UserType.TEACHER)
        .map((user) => user.id),
    );
    const invalid = normalized.filter((id) => !teacherIdsSet.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(
        'targetTeacherId must reference an existing teacher',
      );
    }
  }
}
