import { Body, Controller, Post, Get, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

class LoginDto {
  email: string;
  password: string;
}

interface JwtUser {
  userId: string;
  email: string;
  username: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req: { user: JwtUser }): JwtUser {
    return req.user;
  }
}
