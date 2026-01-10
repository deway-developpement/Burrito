import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserType } from '@app/common';
import type { IUser } from '@app/common';

@Schema({
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class User extends Document implements IUser {
  // Mongoose always adds an id getter based on _id; explicitly type it so DTO requirements match.
  declare readonly id: string;

  @Prop({ unique: true, required: true })
  readonly email!: string;

  @Prop({ required: true, select: false })
  readonly password!: string;

  @Prop({ required: true })
  readonly fullName: string;

  @Prop({ type: Number, enum: UserType, required: true })
  readonly userType: UserType;

  @Prop({ default: null, nullable: true, type: String })
  readonly refresh_token: string | null;

  @Prop({ default: Date.now })
  readonly createdAt!: Date;

  @Prop({ default: Date.now })
  readonly updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
