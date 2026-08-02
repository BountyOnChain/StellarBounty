import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  getAuthChallengeRateLimit,
  getAuthRateLimitTtl,
  getAuthVerifyRateLimit,
} from './auth-rate-limit.config';
import { ChallengeQueryDto, ChallengeResponseDto } from './dto/challenge-query.dto';
import { VerifyDto, VerifyResponseDto } from './dto/verify.dto';
import { RefreshTokenDto, RevokeTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('v1: auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Get authentication challenge nonce' })
  @ApiOkResponse({ description: 'Challenge nonce generated for the Stellar address.', type: ChallengeResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid or missing Stellar address.' })
  @Get('challenge')
  @Throttle({
    default: {
      limit: getAuthChallengeRateLimit,
      ttl: getAuthRateLimitTtl,
    },
  })
  getChallenge(@Query() query: ChallengeQueryDto) {
    return this.authService.getChallenge(query.address);
  }

  @ApiOperation({ summary: 'Verify signed challenge and get JWT' })
  @ApiOkResponse({ description: 'JWT access token for the verified Stellar address.', type: VerifyResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid verification payload.' })
  @ApiUnauthorizedResponse({ description: 'Nonce is invalid, expired, or signature verification failed.' })
  @Post('verify')
  @Throttle({
    default: {
      limit: getAuthVerifyRateLimit,
      ttl: getAuthRateLimitTtl,
    },
  })
  verify(@Body() body: VerifyDto) {
    return this.authService.verify(body.address, body.signature, body.nonce);
  }

  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiOkResponse({ description: 'New access token generated.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or revoked refresh token.' })
  @Post('refresh')
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @ApiOperation({ summary: 'Revoke a token (logout)' })
  @ApiOkResponse({ description: 'Token revoked successfully.' })
  @Post('revoke')
  revoke(@Body() body: RevokeTokenDto) {
    return this.authService.revokeToken(body.token);
  }

  @ApiOperation({ summary: 'Get current user info from JWT token' })
  @ApiOkResponse({ description: 'Address and token expiration time.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token.' })
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    const user = req.user as { address: string; exp: number };
    return {
      address: user.address,
      expiresAt: new Date(user.exp * 1000).toISOString(),
    };
  }
}
