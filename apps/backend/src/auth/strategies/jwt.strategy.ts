import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error(
        'JWT_SECRET is not configured. Set JWT_SECRET in your environment variables.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'],
    });

    this.logger.log('JWT Strategy initialized');
  }

  /**
   * Validate the JWT payload after Passport verifies the signature.
   * Returns the user object attached to `req.user`.
   */
  async validate(payload: JwtPayload): Promise<{ wallet: string }> {
    if (!payload.sub) {
      this.logger.warn('JWT payload missing subject (wallet address)');
      throw new UnauthorizedException('Invalid token payload.');
    }

    return {
      wallet: payload.sub,
    };
  }
}
