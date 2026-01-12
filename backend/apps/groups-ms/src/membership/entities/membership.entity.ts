import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import type { IMembership } from '@app/common';

@Schema({
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Membership extends Document implements IMembership {
  declare readonly id: string;

  @Prop({ required: true })
  groupId: string;

  @Prop({ required: true })
  memberId: string;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);

MembershipSchema.index({ groupId: 1, memberId: 1 }, { unique: true });
MembershipSchema.index({ memberId: 1 });
MembershipSchema.index({ groupId: 1 });
