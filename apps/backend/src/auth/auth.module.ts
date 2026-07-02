import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { createAuthThrottleOptions } from './auth-rate-limit.config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { getJwtSecret } from './get-jwt-secret';
import { Nonce } from '../entities/nonce.entity';

export function createJwtModuleOptions(configService: ConfigService): JwtModuleOptions {
  return {
    secret: getJwtSecret(configService),
    signOptions: {
      expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN', '24h'),
    },
  };
}

@Module({
  imports: [
    PassportModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createAuthThrottleOptions,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createJwtModuleOptions,
    }),
    TypeOrmModule.forFeature([Nonce]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
