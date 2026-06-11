import { ConfigService } from '@nestjs/config';
import {
  createAuthThrottleOptions,
  getAuthChallengeRateLimit,
  getAuthRateLimitTtl,
  getAuthVerifyRateLimit,
} from './auth-rate-limit.config';
import { AuthController } from './auth.controller';

describe('auth rate limit config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AUTH_RATE_LIMIT_TTL_MS;
    delete process.env.AUTH_CHALLENGE_RATE_LIMIT;
    delete process.env.AUTH_VERIFY_RATE_LIMIT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses conservative defaults for auth endpoints', () => {
    expect(getAuthRateLimitTtl()).toBe(60_000);
    expect(getAuthChallengeRateLimit()).toBe(5);
    expect(getAuthVerifyRateLimit()).toBe(10);
  });

  it('allows auth limits to be configured through environment variables', () => {
    process.env.AUTH_RATE_LIMIT_TTL_MS = '30000';
    process.env.AUTH_CHALLENGE_RATE_LIMIT = '3';
    process.env.AUTH_VERIFY_RATE_LIMIT = '8';

    expect(getAuthRateLimitTtl()).toBe(30_000);
    expect(getAuthChallengeRateLimit()).toBe(3);
    expect(getAuthVerifyRateLimit()).toBe(8);
  });

  it('falls back when environment variables are not positive integers', () => {
    process.env.AUTH_RATE_LIMIT_TTL_MS = '0';
    process.env.AUTH_CHALLENGE_RATE_LIMIT = '-1';
    process.env.AUTH_VERIFY_RATE_LIMIT = 'abc';

    expect(getAuthRateLimitTtl()).toBe(60_000);
    expect(getAuthChallengeRateLimit()).toBe(5);
    expect(getAuthVerifyRateLimit()).toBe(10);
  });

  it('configures verify as the default auth throttle', () => {
    const config = {
      get: jest.fn((key: string, fallback: number) => {
        const values: Record<string, number> = {
          AUTH_RATE_LIMIT_TTL_MS: 15_000,
          AUTH_VERIFY_RATE_LIMIT: 7,
        };

        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService;

    expect(createAuthThrottleOptions(config)).toEqual([
      {
        ttl: 15_000,
        limit: 7,
      },
    ]);
  });

  it('overrides the challenge endpoint with the stricter challenge limit', () => {
    const handler = AuthController.prototype.getChallenge;
    const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', handler);
    const ttl = Reflect.getMetadata('THROTTLER:TTLdefault', handler);

    expect(limit()).toBe(5);
    expect(ttl()).toBe(60_000);
  });

  it('applies the verify endpoint limit explicitly', () => {
    const handler = AuthController.prototype.verify;
    const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', handler);
    const ttl = Reflect.getMetadata('THROTTLER:TTLdefault', handler);

    expect(limit()).toBe(10);
    expect(ttl()).toBe(60_000);
  });
});
