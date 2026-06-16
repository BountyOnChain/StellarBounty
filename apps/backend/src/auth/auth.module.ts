import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { createAuthThrottleOptions } from './auth-rate-limit.config';
import { AuthSessionCleanupService } from './auth-session-cleanup.service';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { getJwtSecret } from './get-jwt-secret';
import { Nonce } from '../entities/nonce.entity';
import { RefreshToken } from '../entities/refresh-token.entity';

@Module({
  imports: [
    PassportModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createAuthThrottleOptions,
    }),
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '15m' },
    }),
    TypeOrmModule.forFeature([Nonce, RefreshToken]),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthSessionCleanupService, JwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
