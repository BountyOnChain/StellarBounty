import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { getJwtSecret } from './get-jwt-secret';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly tokenExtractor: (req: Request) => string | null;

  constructor(private readonly authService: AuthService) {
    const extractor = ExtractJwt.fromAuthHeaderAsBearerToken();
    super({
      jwtFromRequest: extractor,
      secretOrKey: getJwtSecret(),
      passReqToCallback: true,
    });
    this.tokenExtractor = extractor;
  }

  validate(req: Request, payload: { sub: string }) {
    const token = this.tokenExtractor(req);
    if (token && this.authService.isRevoked(token)) {
      throw new UnauthorizedException('Token has been revoked');
    }
    return { address: payload.sub };
  }
}
