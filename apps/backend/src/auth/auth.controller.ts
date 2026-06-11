import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  getAuthChallengeRateLimit,
  getAuthRateLimitTtl,
  getAuthVerifyRateLimit,
} from './auth-rate-limit.config';
import { ChallengeQueryDto } from './dto/challenge-query.dto';
import { VerifyDto } from './dto/verify.dto';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Get authentication challenge nonce' })
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
}
