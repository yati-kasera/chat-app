import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ type: Types.ObjectId, refPath: 'recipientModel', required: true })
  recipient: Types.ObjectId;

  @Prop()
  content?: string;

  @Prop({ type: String, required: true, enum: ['User', 'Group'] })
  recipientModel: string;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  group?: Types.ObjectId;

  @Prop()
  fileUrl?: string;

  @Prop()
  fileType?: string;

  @Prop({ type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' })
  status: string;

  @Prop({ type: Boolean, default: false })
  edited: boolean;

  @Prop({ type: Boolean, default: false })
  deleted: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  replyTo?: Types.ObjectId;

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, required: true }
      }
    ],
    default: []
  })
  reactions: { userId: Types.ObjectId; emoji: string }[];
}

export const MessageSchema = SchemaFactory.createForClass(Message); 