import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ type: Types.ObjectId, refPath: 'recipientModel', required: true })
  recipient: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ type: String, required: true, enum: ['User', 'Group'] })
  recipientModel: string;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  group?: Types.ObjectId;
}

export const MessageSchema = SchemaFactory.createForClass(Message); 