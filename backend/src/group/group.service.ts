import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Group, GroupDocument } from './group.schema';

@Injectable()
export class GroupService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
  ) {}

  async createGroup(name: string, creatorId: string, memberIds: string[] = []) {
    const group = new this.groupModel({
      name,
      members: [new Types.ObjectId(creatorId), ...memberIds.map(id => new Types.ObjectId(id))],
      admin: new Types.ObjectId(creatorId),
    });
    return group.save();
  }

  async getGroupById(groupId: string) {
    return this.groupModel.findById(groupId).populate('members', 'username email');
  }

  async getUserGroups(userId: string) {
    return this.groupModel.find({
      members: new Types.ObjectId(userId),
    }).populate('members', 'username email');
  }

  async addMemberToGroup(groupId: string, userId: string, requesterId: string) {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new Error('Group not found');
    if (String(group.admin) !== String(requesterId)) throw new Error('Only admin can add members');
    return this.groupModel.findByIdAndUpdate(
      groupId,
      { $addToSet: { members: new Types.ObjectId(userId) } },
      { new: true }
    ).populate('members', 'username email');
  }

  async removeMemberFromGroup(groupId: string, userId: string, requesterId: string) {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new Error('Group not found');
    if (String(group.admin) !== String(requesterId)) throw new Error('Only admin can remove members');
    return this.groupModel.findByIdAndUpdate(
      groupId,
      { $pull: { members: new Types.ObjectId(userId) } },
      { new: true }
    ).populate('members', 'username email');
  }

  async updateGroupName(groupId: string, name: string) {
    return this.groupModel.findByIdAndUpdate(
      groupId,
      { name },
      { new: true }
    ).populate('members', 'username email');
  }

  async deleteGroup(groupId: string) {
    return this.groupModel.findByIdAndDelete(groupId);
  }

  async isUserMemberOfGroup(groupId: string, userId: string) {
    const group = await this.groupModel.findById(groupId);
    return group?.members.some(member => member.toString() === userId) || false;
  }
}
