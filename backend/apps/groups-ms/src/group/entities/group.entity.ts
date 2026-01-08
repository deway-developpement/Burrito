import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import type { IGroup } from '@app/common';

@Schema({
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Group extends Document implements IGroup {
  declare readonly id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const GroupSchema = SchemaFactory.createForClass(Group);
