// apps/forms-ms/src/form/form.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QueryService } from '@nestjs-query/core';
import { MongooseQueryService } from '@nestjs-query/query-mongoose';
import { Form } from './entities/form.entity';

@Injectable()
@QueryService(Form)
export class FormService extends MongooseQueryService<Form> {
  constructor(@InjectModel(Form.name) private readonly formModel: Model<Form>) {
    super(formModel);
  }

  async findByIds(ids: string[]): Promise<Form[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.formModel.find({ _id: { $in: ids } }).exec();
  }
}
