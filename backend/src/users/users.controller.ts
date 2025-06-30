import { Body, Controller, Post, Get, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';

class RegisterDto {
  username: string;
  email: string;
  password: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    const user = await this.usersService.createUser(body.username, body.email, body.password);
    const { password, ...result } = (user as any).toJSON();
    return result;
  }

  @Get()
  async getAllUsers() {
    const users = await this.usersService.getAllUsers();
    return users.map((user: any) => {
      const { password, ...rest } = user.toJSON();
      return rest;
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMe(@Request() req) {
    // req.user.userId is set by JwtStrategy
    const user = await this.usersService.findById(req.user.userId);
    if (!user) return null;
    // const { password, ...result } = user.toJSON();
    const { password, ...result } = (user as any).toJSON();
    return result;
  }
}
