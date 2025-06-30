import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async createUser(username: string, email: string, password: string): Promise<User> {
    const existing = await this.userModel.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      throw new ConflictException('Email or username already exists');
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = new this.userModel({ username, email, password: hashed });
    return user.save();
  }

  async getAllUsers(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id);
  }
}
