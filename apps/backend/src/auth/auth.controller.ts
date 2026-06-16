import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  getAuthChallengeRateLimit,
  getAuthRateLimitTtl,
  getAuthVerifyRateLimit,
} from './auth-rate-limit.config';
import { ChallengeQueryDto, ChallengeResponseDto } from './dto/challenge-query.dto';
import { VerifyDto, VerifyResponseDto } from './dto/verify.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

type AuthenticatedRequest = Request & {
  user: {
    address: string;
  };
};

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Get authentication challenge nonce' })
  @ApiOkResponse({
    description: 'Challenge nonce generated for the Stellar address.',
    type: ChallengeResponseDto,
  })
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
  @ApiOkResponse({
    description: 'JWT access token for the verified Stellar address.',
    type: VerifyResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid verification payload.' })
  @ApiUnauthorizedResponse({
    description: 'Nonce is invalid, expired, or signature verification failed.',
  })
  @Post('verify')
  @Throttle({
    default: {
      limit: getAuthVerifyRateLimit,
      ttl: getAuthRateLimitTtl,
    },
  })
  async verify(@Body() body: VerifyDto, @Res({ passthrough: true }) response: Response) {
    const tokens = await this.authService.verify(body.address, body.signature, body.nonce);
    this.setRefreshCookie(response, tokens.refreshToken);
    return tokens;
  }

  @ApiOperation({ summary: 'Rotate refresh token and get a new JWT' })
  @ApiOkResponse({ description: 'Rotated access and refresh token pair.', type: VerifyResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid, expired, or already used.' })
  @Post('refresh')
  async refresh(@Body() body: RefreshTokenDto, @Res({ passthrough: true }) response: Response) {
    const tokens = await this.authService.refresh(body.refreshToken);
    this.setRefreshCookie(response, tokens.refreshToken);
    return tokens;
  }

  @ApiOperation({ summary: 'Logout current refresh-token session' })
  @ApiOkResponse({ description: 'Refresh token cookie cleared and session marked as revoked.' })
  @Post('logout')
  async logout(@Body() body: RefreshTokenDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.logout(body.refreshToken);
    response.clearCookie('refreshToken', { path: '/auth' });
    return result;
  }

  @ApiOperation({
    summary: 'Revoke all active refresh-token sessions for the authenticated address',
  })
  @ApiOkResponse({ description: 'All active refresh-token sessions revoked for this address.' })
  @ApiUnauthorizedResponse({ description: 'Access token is missing or invalid.' })
  @Post('revoke-all')
  @UseGuards(JwtAuthGuard)
  revokeAll(@Req() request: AuthenticatedRequest) {
    return this.authService.revokeAll(request.user.address);
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth',
    });
  }
}
