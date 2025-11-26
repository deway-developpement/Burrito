import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { AuthType } from '../../auth/interface/auth.type';

@Schema()
export class User extends Document {
  // Mongoose always adds an id getter based on _id; explicitly type it so DTO requirements match.
  declare readonly id: string;

  @Prop({ unique: true, required: true })
  readonly email!: string;

  @Prop({ required: true })
  readonly password!: string;

  @Prop({ required: true })
  readonly fullName: string;

  @Prop()
  readonly userType: AuthType;

  @Prop({ default: null, nullable: true, type: String })
  readonly refresh_token: string | null;

  @Prop({ default: Date.now })
  readonly createdAt!: Date;

  @Prop({ default: Date.now })
  readonly updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
