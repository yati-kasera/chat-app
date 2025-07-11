import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

interface UserResult {
  _id: string;
  email: string;
  username: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<UserResult | null> {
    const user = await this.usersService['userModel'].findOne({ email });
    if (user && await bcrypt.compare(password, user.password)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...result } = user.toObject();
      return result as UserResult;
    }
    return null;
  }

  async login(email: string, password: string) {
    const user = await this.usersService['userModel'].findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { sub: user._id, email: user.email, username: user.username };
    return {
      access_token: this.jwtService.sign(payload),
      user: { _id: user._id, email: user.email, username: user.username },
    };
  }
}
