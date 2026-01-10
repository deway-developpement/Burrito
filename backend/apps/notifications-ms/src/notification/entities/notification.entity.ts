import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum NotificationStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum NotificationType {
  FORM_PUBLISHED = 'FORM_PUBLISHED',
  FORM_REMINDER = 'FORM_REMINDER',
  EVALUATION_SUBMITTED = 'EVALUATION_SUBMITTED',
  FORM_CLOSED = 'FORM_CLOSED',
  FORM_COMPLETED = 'FORM_COMPLETED',
  ANALYTICS_DIGEST_READY = 'ANALYTICS_DIGEST_READY',
}

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Notification extends Document {
  declare readonly id: string;

  @Prop({ enum: NotificationType, required: true })
  type: NotificationType;

  @Prop({ required: true })
  recipientEmail: string;

  @Prop()
  recipientUserId?: string;

  @Prop({ type: Object })
  payload?: Record<string, unknown>;

  @Prop({ enum: NotificationStatus, default: NotificationStatus.QUEUED })
  status: NotificationStatus;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ type: String, default: null })
  lastError: string | null;

  @Prop({ required: true, unique: true })
  idempotencyKey: string;

  @Prop()
  sentAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ idempotencyKey: 1 }, { unique: true });
NotificationSchema.index({ status: 1 });
NotificationSchema.index({ createdAt: -1 });
