import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async sendMessage(sender: string, recipient: string, content: string) {
    const message = new this.messageModel({
      sender: new Types.ObjectId(sender),
      recipient: new Types.ObjectId(recipient),
      content,
      recipientModel: 'User',
    });
    return message.save();
  }

  async sendGroupMessage(sender: string, groupId: string, content: string) {
    const message = new this.messageModel({
      sender: new Types.ObjectId(sender),
      recipient: new Types.ObjectId(groupId),
      content,
      recipientModel: 'Group',
      group: new Types.ObjectId(groupId),
    });
    return message.save();
  }

  async getMessagesBetweenUsers(userA: string, userB: string) {
    return this.messageModel.find({
      $or: [
        { sender: new Types.ObjectId(userA), recipient: new Types.ObjectId(userB), recipientModel: 'User' },
        { sender: new Types.ObjectId(userB), recipient: new Types.ObjectId(userA), recipientModel: 'User' },
      ],
    })
    .sort({ createdAt: 1 })
    .populate('sender', 'username');
  }

  async getGroupMessages(groupId: string) {
    return this.messageModel.find({
      recipient: new Types.ObjectId(groupId),
      recipientModel: 'Group',
    })
    .sort({ createdAt: 1 })
    .populate('sender', 'username');
  }
}
