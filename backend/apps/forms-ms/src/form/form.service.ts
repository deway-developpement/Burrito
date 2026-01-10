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
    const forms = await this.formModel.find({ _id: { $in: ids } }).exec();
    return forms.map((form) => this.withStatus(form));
  }

  async createOne(dto: Partial<Form>): Promise<Form> {
    const status = dto.status ?? FormStatus.DRAFT;
    this.ensurePublishable(status, dto.startDate, dto.endDate);
    const created = await super.createOne({ ...dto, status });
    this.emitStatusEvents(undefined, created);
    return created;
  }

  async query(query: Query<Form>): Promise<Form[]> {
    const forms = await super.query(query);
    return forms.map((form) => this.withStatus(form));
  }

  async findById(id: string): Promise<Form | undefined> {
    const form = await super.findById(id);
    return this.withStatus(form);
  }

  async getById(id: string): Promise<Form> {
    const form = await super.getById(id);
    return this.withStatus(form) as Form;
  }

  async createMany(dtos: Partial<Form>[]): Promise<Form[]> {
    const normalized = dtos.map((dto) => {
      const status = dto.status ?? FormStatus.DRAFT;
      this.ensurePublishable(status, dto.startDate, dto.endDate);
      return { ...dto, status };
    });
    const created = await super.createMany(normalized);
    created.forEach((form) => this.emitStatusEvents(undefined, form));
    return created;
  }

  async updateOne(id: string, update: Partial<Form>): Promise<Form> {
    const before = await this.formModel.findById(id).lean<Form>().exec();
    const beforeStatus = this.resolveStatus(before || undefined);
    const nextStatus = update.status ?? beforeStatus;
    const nextStartDate = update.startDate ?? before?.startDate;
    const nextEndDate = update.endDate ?? before?.endDate;
    this.ensurePublishable(nextStatus, nextStartDate, nextEndDate);
    const updated = await super.updateOne(id, update);
    this.emitStatusEvents(before || undefined, updated);
    return updated;
  }

  private withStatus(form?: Form): Form | undefined {
    if (!form) {
      return undefined;
    }
    if (!form.status) {
      (form as Form & { status: FormStatus }).status = this.resolveStatus(form);
    }
    return form;
  }

  private emitStatusEvents(before: Form | undefined, after: Form): void {
    const beforeStatus = this.resolveStatus(before);
    const afterStatus = this.resolveStatus(after);
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

  private resolveStatus(form?: Partial<Form>): FormStatus {
    if (!form) {
      return FormStatus.DRAFT;
    }
    if (form.status) {
      return form.status;
    }
    const now = Date.now();
    const endDate = this.toDate(form.endDate);
    const startDate = this.toDate(form.startDate);
    const legacyActive = (form as { isActive?: boolean }).isActive;
    if (legacyActive === false) {
      return FormStatus.CLOSED;
    }
    if (endDate && endDate.getTime() <= now) {
      return FormStatus.CLOSED;
    }
    if (legacyActive === true) {
      if (startDate && startDate.getTime() > now) {
        return FormStatus.DRAFT;
      }
      return FormStatus.PUBLISHED;
    }
    return FormStatus.DRAFT;
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
