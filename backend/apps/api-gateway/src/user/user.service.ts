import {
  GatewayTimeoutException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { MICROSERVICE_TIMEOUT_MS } from '../constants';
import { ClientProxy } from '@nestjs/microservices';
import {
  Query,
  AggregateQuery,
  AggregateResponse,
  QueryService,
  Filter,
  Class,
  FindRelationOptions,
  ModifyRelationOptions,
  UpdateManyResponse,
  DeepPartial,
  DeleteManyResponse,
} from '@nestjs-query/core';
import {
  Observable,
  TimeoutError,
  catchError,
  firstValueFrom,
  timeout,
} from 'rxjs';
import { UserDto } from './dto/user.dto';
import { IUser } from '@app/common';

@Injectable()
@QueryService<UserDto>(UserDto)
export class UserService {
  constructor(
    @Inject('USER_SERVICE') // must match ClientsModule.register({ name: 'USER_SERVICE', ... })
    private readonly userClient: ClientProxy,
  ) {}

  /**
   * Called by CRUDResolver for list queries with filters, paging, sorting...
   */
  async query(query: Query<UserDto>): Promise<UserDto[]> {
    return this.sendWithTimeout(
      this.userClient.send<UserDto[]>({ cmd: 'user.query' }, query),
    );
  }

  /**
   * Called by CRUDResolver for single item fetch by id.
   */
  async findById(id: string): Promise<IUser | undefined> {
    return this.sendWithTimeout(
      this.userClient.send<IUser | undefined>({ cmd: 'user.findById' }, id),
    );
  }

  async findByIds(ids: string[]): Promise<UserDto[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.sendWithTimeout(
      this.userClient.send<UserDto[]>({ cmd: 'user.findByIds' }, ids),
    );
  }

  /**
   * Used by nestjs-query for aggregate endpoints (if enabled).
   * Safe to implement even if you don’t expose the GraphQL aggregate queries yet.
   */
  async aggregate(
    filter: Filter<UserDto>,
    query: AggregateQuery<UserDto>,
  ): Promise<AggregateResponse<UserDto>[]> {
    return this.sendWithTimeout(
      this.userClient.send<AggregateResponse<UserDto>[]>(
        { cmd: 'user.aggregate' },
        { filter, aggregate: query },
      ),
    );
  }

  /**
   * Used for total count (pagination meta).
   */
  async count(query: Filter<UserDto>): Promise<number> {
    return this.sendWithTimeout(
      this.userClient.send<number>({ cmd: 'user.count' }, query),
    );
  }

  queryRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: UserDto,
    query: Query<Relation>,
  ): Promise<Relation[]>;

  queryRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: UserDto[],
    query: Query<Relation>,
  ): Promise<Map<UserDto, Relation[]>>;

  async queryRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: UserDto | UserDto[],
    query: Query<Relation>,
  ): Promise<Map<UserDto, Relation[]> | Relation[]> {
    return this.sendWithTimeout(
      this.userClient.send<Map<UserDto, Relation[]> | Relation[]>(
        { cmd: 'user.queryRelations' },
        { relationName, dto, query },
      ),
    );
  }

  aggregateRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: UserDto,
    filter: Filter<Relation>,
    aggregate: AggregateQuery<Relation>,
  ): Promise<AggregateResponse<Relation>[]>;
  aggregateRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: UserDto[],
    filter: Filter<Relation>,
    aggregate: AggregateQuery<Relation>,
  ): Promise<Map<UserDto, AggregateResponse<Relation>[]>>;

  async aggregateRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: UserDto | UserDto[],
    filter: Filter<Relation>,
    aggregate: AggregateQuery<Relation>,
  ): Promise<
    AggregateResponse<Relation>[] | Map<UserDto, AggregateResponse<Relation>[]>
  > {
    return this.sendWithTimeout(
      this.userClient.send<
        | AggregateResponse<Relation>[]
        | Map<UserDto, AggregateResponse<Relation>[]>
      >(
        { cmd: 'user.aggregateRelations' },
        { relationName, dto, filter, aggregate },
      ),
    );
  }

  countRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: UserDto,
    filter: Filter<Relation>,
  ): Promise<number>;
  countRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: UserDto[],
    filter: Filter<Relation>,
  ): Promise<Map<UserDto, number>>;

  async countRelations<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: UserDto | UserDto[],
    filter: Filter<Relation>,
  ): Promise<number | Map<UserDto, number>> {
    return this.sendWithTimeout(
      this.userClient.send<number | Map<UserDto, number>>(
        { cmd: 'user.countRelations' },
        { relationName, dto, filter },
      ),
    );
  }

  findRelation<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dto: UserDto,
    opts?: FindRelationOptions<Relation>,
  ): Promise<Relation | undefined>;

  findRelation<Relation>(
    RelationClass: Class<Relation>,
    relationName: string,
    dtos: UserDto[],
    opts?: FindRelationOptions<Relation>,
  ): Promise<Map<UserDto, Relation | undefined>>;

  async findRelation<Relation>(
    RelationClass: new () => Relation,
    relationName: string,
    dto: UserDto | UserDto[],
  ): Promise<Relation | undefined | Map<UserDto, Relation | undefined>> {
    return this.sendWithTimeout(
      this.userClient.send<
        Relation | undefined | Map<UserDto, Relation | undefined>
      >({ cmd: 'user.findRelation' }, { relationName, dto }),
    );
  }

  async addRelations<Relation>(
    relationName: string,
    id: string | number,
    relationIds: (string | number)[],
    opts?: ModifyRelationOptions<UserDto, Relation>,
  ): Promise<UserDto> {
    return this.sendWithTimeout(
      this.userClient.send<UserDto>(
        { cmd: 'user.addRelations' },
        { relationName, id, relationIds, opts },
      ),
    );
  }

  async setRelation<Relation>(
    relationName: string,
    id: string | number,
    relationId: string,
    opts?: ModifyRelationOptions<UserDto, Relation>,
  ): Promise<UserDto> {
    return this.sendWithTimeout(
      this.userClient.send<UserDto>(
        { cmd: 'user.setRelation' },
        { relationName, id, relationId, opts },
      ),
    );
  }

  async setRelations<Relation>(
    relationName: string,
    id: string | number,
    relationIds: (string | number)[],
    opts?: ModifyRelationOptions<UserDto, Relation>,
  ): Promise<UserDto> {
    return this.sendWithTimeout(
      this.userClient.send<UserDto>(
        { cmd: 'user.setRelations' },
        { relationName, id, relationIds, opts },
      ),
    );
  }

  async removeRelation<Relation>(
    relationName: string,
    id: string | number,
    relationId: string | number,
    opts?: ModifyRelationOptions<UserDto, Relation>,
  ): Promise<UserDto> {
    return this.sendWithTimeout(
      this.userClient.send<UserDto>(
        { cmd: 'user.removeRelation' },
        { relationName, id, relationId, opts },
      ),
    );
  }

  async removeRelations<Relation>(
    relationName: string,
    id: string | number,
    relationIds: (string | number)[],
    opts?: ModifyRelationOptions<UserDto, Relation>,
  ): Promise<UserDto> {
    return this.sendWithTimeout(
      this.userClient.send<UserDto>(
        { cmd: 'user.removeRelations' },
        { relationName, id, relationIds, opts },
      ),
    );
  }

  async getById(id: string): Promise<UserDto> {
    return this.sendWithTimeout(
      this.userClient.send<UserDto>({ cmd: 'user.getById' }, id),
    );
  }

  /**
   * If later you re-enable writes, you can wire these:
   */
  async createOne(dto: Partial<UserDto>): Promise<UserDto> {
    const user = await this.sendWithTimeout(
      this.userClient.send<IUser>({ cmd: 'user.createOne' }, dto),
    );
    return user;
  }

  async createMany(dtos: Partial<UserDto>[]): Promise<UserDto[]> {
    return this.sendWithTimeout(
      this.userClient.send<UserDto[]>({ cmd: 'user.createMany' }, dtos),
    );
  }

  async updateOne(id: string, update: Partial<IUser>): Promise<IUser> {
    return this.sendWithTimeout(
      this.userClient.send<IUser>({ cmd: 'user.updateOne' }, { id, update }),
    );
  }

  async updateMany(
    update: DeepPartial<UserDto>,
    filter: Filter<UserDto>,
  ): Promise<UpdateManyResponse> {
    return this.sendWithTimeout(
      this.userClient.send<UpdateManyResponse>(
        { cmd: 'user.updateMany' },
        { update, filter },
      ),
    );
  }

  async deleteOne(id: string): Promise<UserDto> {
    return this.sendWithTimeout(
      this.userClient.send<UserDto>({ cmd: 'user.deleteOne' }, id),
    );
  }

  async deleteMany(filter: Filter<UserDto>): Promise<DeleteManyResponse> {
    return this.sendWithTimeout(
      this.userClient.send<DeleteManyResponse>(
        { cmd: 'user.deleteMany' },
        filter,
      ),
    );
  }

  /**
   * Custom methods
   */

  async findByEmail(email: string): Promise<IUser | undefined> {
    return this.sendWithTimeout(
      this.userClient.send<IUser | undefined>(
        { cmd: 'user.findByEmail' },
        email,
      ),
    );
  }

  private async sendWithTimeout<T>(observable: Observable<T>): Promise<T> {
    return firstValueFrom(
      observable.pipe(
        timeout(MICROSERVICE_TIMEOUT_MS),
        catchError((err) => {
          if (err instanceof TimeoutError) {
            throw new GatewayTimeoutException('User service timed out');
          }
          throw err;
        }),
      ),
    );
  }
}
