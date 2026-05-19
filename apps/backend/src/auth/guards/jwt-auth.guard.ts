import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    // Check if the route is marked as @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context) as boolean | Promise<boolean>;
  }

  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser,
    info: Error | string | null,
  ): TUser {
    if (err || !user) {
      const message =
        info instanceof Error
          ? info.message
          : typeof info === 'string'
            ? info
            : 'Authentication required';

      this.logger.warn(`Auth failed: ${message}`);
      throw err || new UnauthorizedException(message);
    }

    return user;
  }
}
