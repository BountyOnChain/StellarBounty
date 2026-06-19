import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
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

@ApiTags('v1: auth')
@Controller('api/v1/auth')
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
  async verify(
    @Body() body: VerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.verify(
      body.address,
      body.signature,
      body.nonce,
    );

    // Set access token as httpOnly cookie (15 min)
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    // Set refresh token as httpOnly cookie (7 days)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/auth/refresh',
    });

    return { accessToken };
  }

  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiOkResponse({ description: 'New access token and refresh token issued.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token.' })
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refreshTokens(refreshToken);

    // Set new access token cookie
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    // Set new refresh token cookie (rotation)
    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    });

    return { accessToken };
  }

  @ApiOperation({ summary: 'Logout — clear auth cookies and invalidate refresh token' })
  @ApiOkResponse({ description: 'Successfully logged out.' })
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Clear both cookies
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth/refresh' });

    return { success: true };
  }

  @ApiOperation({ summary: 'Revoke all active sessions for the authenticated user' })
  @ApiOkResponse({ description: 'All sessions revoked.' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated.' })
  @Post('revoke')
  async revoke(@Req() req: Request) {
    const address = (req as any).user?.address;
    if (!address) {
      throw new UnauthorizedException('Not authenticated');
    }
    await this.authService.revokeAllForUser(address);
    return { success: true };
  }
}
