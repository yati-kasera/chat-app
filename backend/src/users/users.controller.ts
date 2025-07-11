import { Body, Controller, Post, Get, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { UserDocument } from './user.schema';
import { ChatGateway } from '../chat/chat.gateway';

class RegisterDto {
  username: string;
  email: string;
  password: string;
}

interface UserResult {
  _id: string;
  email: string;
  username: string;
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly chatGateway: ChatGateway
  ) {}

  @Post('register')
  async register(@Body() body: RegisterDto): Promise<Omit<UserResult, 'password'>> {
    const user = await this.usersService.createUser(body.username, body.email, body.password) as UserDocument;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user.toJSON() as UserResult & { password?: string };
    return result;
  }

  @Get()
  async getAllUsers(): Promise<Omit<UserResult, 'password'>[]> {
    const users = await this.usersService.getAllUsers() as UserDocument[];
    return users.map((user) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...rest } = user.toJSON() as UserResult & { password?: string };
      return rest;
    });
  }

  @Get('online')
  async getOnlineUsers(): Promise<string[]> {
    return this.chatGateway.getOnlineUsers();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMe(@Request() req: { user: { userId: string } }): Promise<Omit<UserResult, 'password'> | null> {
    // req.user.userId is set by JwtStrategy
    const user = await this.usersService.findById(req.user.userId) as UserDocument | null;
    if (!user) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user.toJSON() as UserResult & { password?: string };
    return result;
  }
}
