// import { Injectable } from '@nestjs/common';
// import { PassportStrategy } from '@nestjs/passport';
// import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';

// interface JwtPayload {
//   sub: string;
//   email: string;
//   username: string;
// }

// @Injectable()
// export class JwtStrategy extends PassportStrategy(Strategy) {
//   constructor() {
//     // super({
//     const opts: StrategyOptions = {
//       jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
//       ignoreExpiration: false,
//       secretOrKey: 'SECRET_KEY', // TODO: use env variable
//     // });
//     };
//     super(opts);
//   }

//   validate(payload: JwtPayload) {
//     return { userId: payload.sub, email: payload.email, username: payload.username };
//   }
// } 






import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { Request } from 'express';

interface JwtPayload {
  sub: string;
  email: string;
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    // Explicitly type jwtFromRequest as (req: Request) => string | null
    const jwtFromRequest: StrategyOptions['jwtFromRequest'] = ExtractJwt.fromAuthHeaderAsBearerToken();
    const opts: StrategyOptions = {
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: 'SECRET_KEY', // TODO: use env variable
    };
    super(opts);
  }

  validate(payload: JwtPayload) {
    return { userId: payload.sub, email: payload.email, username: payload.username };
  }
} 
