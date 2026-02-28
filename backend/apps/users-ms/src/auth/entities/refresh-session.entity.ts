import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserType } from '@app/common';

export enum RefreshSessionStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class RefreshSession extends Document {
  declare readonly id: string;

  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true, unique: true })
  sessionId!: string;

  @Prop({ type: String, required: true, index: true })
  familyId!: string;

  @Prop({ type: String, required: true, unique: true, sparse: true })
  currentJti!: string;

  @Prop({ type: String, required: true })
  currentRefreshToken!: string;

  @Prop({ type: String, default: null, index: true })
  previousJti!: string | null;

  @Prop({ type: Date, default: null, index: true })
  previousRotatedAt!: Date | null;

  @Prop({ type: String, required: true })
  userEmail!: string;

  @Prop({ type: Number, enum: UserType, required: true })
  userType!: UserType;

  @Prop({
    type: String,
    enum: RefreshSessionStatus,
    default: RefreshSessionStatus.ACTIVE,
    index: true,
  })
  status!: RefreshSessionStatus;

  @Prop({ type: Date, required: true })
  issuedAt!: Date;

  @Prop({ type: Date, required: true })
  lastUsedAt!: Date;

  @Prop({ type: Date, required: true })
  lastRotatedAt!: Date;

  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null, index: true })
  revokedAt!: Date | null;

  @Prop({ type: Date, default: null, index: true })
  reuseDetectedAt!: Date | null;

  @Prop({ type: Date, default: null, index: true })
  deleteAt!: Date | null;

  @Prop({ type: String, default: null })
  reason!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: String, default: null })
  ip!: string | null;
}

export const RefreshSessionSchema = SchemaFactory.createForClass(RefreshSession);

RefreshSessionSchema.index({ userId: 1, status: 1, lastUsedAt: -1 });
RefreshSessionSchema.index({ familyId: 1, status: 1 });
RefreshSessionSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });
