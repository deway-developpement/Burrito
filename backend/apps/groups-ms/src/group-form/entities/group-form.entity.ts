import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import type { IGroupForm } from '@app/common';

@Schema({
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class GroupForm extends Document implements IGroupForm {
  declare readonly id: string;

  @Prop({ required: true })
  groupId: string;

  @Prop({ required: true })
  formId: string;
}

export const GroupFormSchema = SchemaFactory.createForClass(GroupForm);

GroupFormSchema.index(
  { groupId: 1, formId: 1 },
  { unique: true },
);
GroupFormSchema.index({ groupId: 1 });
GroupFormSchema.index({ formId: 1 });
