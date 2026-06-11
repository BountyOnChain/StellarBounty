import { ConfigService } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_CHALLENGE_LIMIT = 5;
const DEFAULT_VERIFY_LIMIT = 10;

function readPositiveInteger(name: string, fallback: number): number {
  const value = process.env[name];
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAuthRateLimitTtl(): number {
  return readPositiveInteger('AUTH_RATE_LIMIT_TTL_MS', DEFAULT_TTL_MS);
}

export function getAuthChallengeRateLimit(): number {
  return readPositiveInteger('AUTH_CHALLENGE_RATE_LIMIT', DEFAULT_CHALLENGE_LIMIT);
}

export function getAuthVerifyRateLimit(): number {
  return readPositiveInteger('AUTH_VERIFY_RATE_LIMIT', DEFAULT_VERIFY_LIMIT);
}

export function createAuthThrottleOptions(
  config: ConfigService,
): ThrottlerModuleOptions {
  return [
    {
      ttl: config.get<number>('AUTH_RATE_LIMIT_TTL_MS', DEFAULT_TTL_MS),
      limit: config.get<number>('AUTH_VERIFY_RATE_LIMIT', DEFAULT_VERIFY_LIMIT),
    },
  ];
}
