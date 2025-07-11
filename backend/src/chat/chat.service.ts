import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async sendMessage(sender: string, recipient: string, content: string, file?: Express.Multer.File, replyTo?: string) {
    let fileUrl: string | undefined = undefined;
    let fileType: string | undefined = undefined;
    if (file) {
      fileUrl = `/uploads/${file.filename}`;
      fileType = file.mimetype;
    }
    const message = new this.messageModel({
      sender: new Types.ObjectId(sender),
      recipient: new Types.ObjectId(recipient),
      content,
      recipientModel: 'User',
      fileUrl,
      fileType,
      replyTo: replyTo ? new Types.ObjectId(replyTo) : undefined,
    });
    return message.save();
  }

  async sendGroupMessage(sender: string, groupId: string, content: string, file?: Express.Multer.File, replyTo?: string) {
    let fileUrl: string | undefined = undefined;
    let fileType: string | undefined = undefined;
    if (file) {
      fileUrl = `/uploads/${file.filename}`;
      fileType = file.mimetype;
    }
    const message = new this.messageModel({
      sender: new Types.ObjectId(sender),
      recipient: new Types.ObjectId(groupId),
      content,
      recipientModel: 'Group',
      group: new Types.ObjectId(groupId),
      fileUrl,
      fileType,
      replyTo: replyTo ? new Types.ObjectId(replyTo) : undefined,
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
    .populate('sender', 'username')
    .populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } });
  }

  async getGroupMessages(groupId: string) {
    return this.messageModel.find({
      recipient: new Types.ObjectId(groupId),
      recipientModel: 'Group',
    })
    .sort({ createdAt: 1 })
    .populate('sender', 'username')
    .populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } });
  }

  async editMessage(messageId: string, userId: string, newContent: string) {
    const msg = await this.messageModel.findById(messageId);
    if (!msg) throw new Error('Message not found');
    if (msg.sender.toString() !== userId) throw new Error('Not authorized');
    msg.content = newContent;
    msg.edited = true;
    await msg.save();
    return msg;
  }

  async deleteMessage(messageId: string, userId: string) {
    const msg = await this.messageModel.findById(messageId);
    if (!msg) throw new Error('Message not found');
    if (msg.sender.toString() !== userId) throw new Error('Not authorized');
    msg.deleted = true;
    msg.content = '';
    msg.deletedAt = new Date();
    await msg.save();
    return msg;
  }

  async editGroupMessage(messageId: string, userId: string, newContent: string) {
    const msg = await this.messageModel.findById(messageId);
    if (!msg) throw new Error('Message not found');
    if (msg.sender.toString() !== userId || msg.recipientModel !== 'Group') throw new Error('Not authorized');
    msg.content = newContent;
    msg.edited = true;
    await msg.save();
    return msg;
  }

  async deleteGroupMessage(messageId: string, userId: string) {
    const msg = await this.messageModel.findById(messageId);
    if (!msg) throw new Error('Message not found');
    if (msg.sender.toString() !== userId || msg.recipientModel !== 'Group') throw new Error('Not authorized');
    msg.deleted = true;
    msg.content = '';
    msg.deletedAt = new Date();
    await msg.save();
    return msg;
  }

  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const msg = await this.messageModel.findById(messageId);
    if (!msg) throw new Error('Message not found');
    const existingIndex = msg.reactions.findIndex(r => r.userId.toString() === userId && r.emoji === emoji);
    if (existingIndex !== -1) {
      // Remove reaction
      msg.reactions.splice(existingIndex, 1);
    } else {
      // Add reaction
      msg.reactions.push({ userId: new Types.ObjectId(userId), emoji });
    }
    await msg.save();
    return msg;
  }
}
