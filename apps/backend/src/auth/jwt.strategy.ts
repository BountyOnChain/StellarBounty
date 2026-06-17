import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { getJwtSecret } from './get-jwt-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: (req: Request) => {
        // First try Authorization header (backward compat)
        const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        if (fromHeader) return fromHeader;

        // Then try httpOnly cookie
        if (req.cookies?.access_token) {
          return req.cookies.access_token;
        }

        return null;
      },
      secretOrKey: getJwtSecret(),
      ignoreExpiration: false,
    });
  }

  validate(payload: { sub: string }) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return { address: payload.sub };
  }
}
