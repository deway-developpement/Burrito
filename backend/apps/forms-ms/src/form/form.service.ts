// apps/forms-ms/src/form/form.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Query, QueryService } from '@nestjs-query/core';
import { MongooseQueryService } from '@nestjs-query/query-mongoose';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { FormStatus } from '@app/common';
import { Form } from './entities/form.entity';

@Injectable()
@QueryService(Form)
export class FormService extends MongooseQueryService<Form> {
  private readonly logger = new Logger(FormService.name);

  constructor(
    @InjectModel(Form.name) private readonly formModel: Model<Form>,
    @Inject('NOTIFICATIONS_EVENTS')
    private readonly notificationsClient: ClientProxy,
  ) {
    super(formModel);
  }

  async findByIds(ids: string[]): Promise<Form[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.formModel.find({ _id: { $in: ids } }).exec();
  }

  async createOne(dto: Partial<Form>): Promise<Form> {
    const status = dto.status ?? FormStatus.DRAFT;
    this.ensureTransition(FormStatus.DRAFT, status);
    this.ensurePublishable(status, dto.startDate, dto.endDate);
    const created = await super.createOne({ ...dto, status });
    this.emitStatusEvents(undefined, created);
    return created;
  }

  async query(query: Query<Form>): Promise<Form[]> {
    return super.query(query);
  }

  async findById(id: string): Promise<Form | undefined> {
    return super.findById(id);
  }

  async getById(id: string): Promise<Form> {
    return super.getById(id);
  }

  async createMany(dtos: Partial<Form>[]): Promise<Form[]> {
    const normalized = dtos.map((dto) => {
      const status = dto.status ?? FormStatus.DRAFT;
      this.ensureTransition(FormStatus.DRAFT, status);
      this.ensurePublishable(status, dto.startDate, dto.endDate);
      return { ...dto, status };
    });
    const created = await super.createMany(normalized);
    created.forEach((form) => this.emitStatusEvents(undefined, form));
    return created;
  }

  async updateOne(id: string, update: Partial<Form>): Promise<Form> {
    const before = await this.formModel.findById(id).lean<Form>().exec();
    const beforeStatus = before?.status ?? FormStatus.DRAFT;
    const nextStatus = update.status ?? beforeStatus;
    const nextStartDate = update.startDate ?? before?.startDate;
    const nextEndDate = update.endDate ?? before?.endDate;
    this.ensureTransition(beforeStatus, nextStatus);
    this.ensurePublishable(nextStatus, nextStartDate, nextEndDate);
    const updated = await super.updateOne(id, update);
    this.emitStatusEvents(before || undefined, updated);
    return updated;
  }

  private emitStatusEvents(before: Form | undefined, after: Form): void {
    const beforeStatus = before?.status ?? FormStatus.DRAFT;
    const afterStatus = after.status ?? FormStatus.DRAFT;
    if (
      afterStatus === FormStatus.PUBLISHED &&
      beforeStatus !== FormStatus.PUBLISHED
    ) {
      const payload = {
        eventId: `${after.id}:published`,
        formId: after.id,
        occurredAt: new Date().toISOString(),
      };
      this.emitEvent('form.published', payload);
    }

    if (
      afterStatus === FormStatus.CLOSED &&
      beforeStatus !== FormStatus.CLOSED
    ) {
      const payload = {
        eventId: `${after.id}:closed`,
        formId: after.id,
        occurredAt: new Date().toISOString(),
      };
      this.emitEvent('form.closed', payload);
    }
  }

  private ensurePublishable(
    status: FormStatus,
    startDate?: Date,
    endDate?: Date,
  ): void {
    if (status !== FormStatus.PUBLISHED) {
      return;
    }
    const normalizedStart = this.toDate(startDate);
    const normalizedEnd = this.toDate(endDate);
    if (!normalizedStart || !normalizedEnd) {
      throw new RpcException({
        status: 400,
        message: 'Published forms require valid startDate and endDate',
      });
    }
    if (normalizedStart.getTime() > normalizedEnd.getTime()) {
      throw new RpcException({
        status: 400,
        message: 'startDate must be before or equal to endDate',
      });
    }
  }

  private ensureTransition(fromStatus: FormStatus, toStatus: FormStatus): void {
    if (fromStatus === toStatus) {
      return;
    }
    if (fromStatus === FormStatus.DRAFT && toStatus === FormStatus.PUBLISHED) {
      return;
    }
    if (fromStatus === FormStatus.PUBLISHED && toStatus === FormStatus.CLOSED) {
      return;
    }
    throw new RpcException({
      status: 400,
      message: `Invalid form status transition: ${fromStatus} -> ${toStatus}`,
    });
  }

  private toDate(value?: Date): Date | undefined {
    if (!value) {
      return undefined;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    return date;
  }

  private emitEvent(event: string, payload: Record<string, unknown>): void {
    void this.notificationsClient.emit(event, payload).subscribe({
      error: (error) => {
        this.logger.warn(
          `Failed to emit ${event}: ${error instanceof Error ? error.message : String(error)}`,
        );
      },
    });
  }
}
