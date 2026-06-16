import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import {
  createApiThrottleOptions,
  createAuthThrottleOptions,
  getAuthenticatedAddressTracker,
  getAuthChallengeRateLimit,
  getAuthRateLimitTtl,
  getAuthVerifyRateLimit,
  getBountyCreateRateLimit,
  getGlobalGetRateLimit,
  getSubmissionCreateRateLimit,
} from './auth-rate-limit.config';
import { AuthController } from './auth.controller';
import { BountiesController } from '../bounties.controller';
import { SubmissionsController } from '../submissions/submissions.controller';

describe('auth rate limit config', () => {
  const originalEnv = process.env;
  const context = {} as ExecutionContext;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AUTH_RATE_LIMIT_TTL_MS;
    delete process.env.AUTH_CHALLENGE_RATE_LIMIT;
    delete process.env.AUTH_VERIFY_RATE_LIMIT;
    delete process.env.BOUNTY_CREATE_RATE_LIMIT;
    delete process.env.SUBMISSION_CREATE_RATE_LIMIT;
    delete process.env.GLOBAL_GET_RATE_LIMIT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses conservative defaults for auth endpoints', () => {
    expect(getAuthRateLimitTtl()).toBe(60_000);
    expect(getAuthChallengeRateLimit()).toBe(5);
    expect(getAuthVerifyRateLimit()).toBe(10);
    expect(getBountyCreateRateLimit()).toBe(10);
    expect(getSubmissionCreateRateLimit()).toBe(20);
    expect(getGlobalGetRateLimit()).toBe(100);
  });

  it('allows API limits to be configured through environment variables', () => {
    process.env.AUTH_RATE_LIMIT_TTL_MS = '30000';
    process.env.AUTH_CHALLENGE_RATE_LIMIT = '3';
    process.env.AUTH_VERIFY_RATE_LIMIT = '8';
    process.env.BOUNTY_CREATE_RATE_LIMIT = '11';
    process.env.SUBMISSION_CREATE_RATE_LIMIT = '22';
    process.env.GLOBAL_GET_RATE_LIMIT = '150';

    expect(getAuthRateLimitTtl()).toBe(30_000);
    expect(getAuthChallengeRateLimit()).toBe(3);
    expect(getAuthVerifyRateLimit()).toBe(8);
    expect(getBountyCreateRateLimit()).toBe(11);
    expect(getSubmissionCreateRateLimit()).toBe(22);
    expect(getGlobalGetRateLimit()).toBe(150);
  });

  it('falls back when environment variables are not positive integers', () => {
    process.env.AUTH_RATE_LIMIT_TTL_MS = '0';
    process.env.AUTH_CHALLENGE_RATE_LIMIT = '-1';
    process.env.AUTH_VERIFY_RATE_LIMIT = 'abc';
    process.env.BOUNTY_CREATE_RATE_LIMIT = '0';
    process.env.SUBMISSION_CREATE_RATE_LIMIT = '-2';
    process.env.GLOBAL_GET_RATE_LIMIT = 'NaN';

    expect(getAuthRateLimitTtl()).toBe(60_000);
    expect(getAuthChallengeRateLimit()).toBe(5);
    expect(getAuthVerifyRateLimit()).toBe(10);
    expect(getBountyCreateRateLimit()).toBe(10);
    expect(getSubmissionCreateRateLimit()).toBe(20);
    expect(getGlobalGetRateLimit()).toBe(100);
  });

  it('configures GET-friendly global throttling with a clear 429 message', () => {
    const config = {
      get: jest.fn((key: string, fallback: number) => {
        const values: Record<string, number> = {
          AUTH_RATE_LIMIT_TTL_MS: 15_000,
          GLOBAL_GET_RATE_LIMIT: 75,
        };

        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService;

    expect(createApiThrottleOptions(config)).toEqual({
      errorMessage: 'Too many requests. Please wait before trying again.',
      throttlers: [{
        ttl: 15_000,
        limit: 75,
      }],
    });
    expect(createAuthThrottleOptions(config)).toEqual(createApiThrottleOptions(config));
  });

  it('tracks authenticated endpoints by the JWT subject when available', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'GABC123' })).toString('base64url');
    const req = {
      headers: {
        authorization: `Bearer header.${payload}.signature`,
      },
      ip: '127.0.0.1',
    };

    expect(getAuthenticatedAddressTracker(req, context)).toBe('GABC123');
  });

  it('falls back to the request IP when the bearer token has no address', () => {
    expect(getAuthenticatedAddressTracker({ headers: {}, ip: '127.0.0.1' }, context)).toBe('127.0.0.1');
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

  it('rate limits bounty mutations per authenticated address', () => {
    for (const handler of [
      BountiesController.prototype.create,
      BountiesController.prototype.update,
      BountiesController.prototype.remove,
    ]) {
      const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', handler);
      const ttl = Reflect.getMetadata('THROTTLER:TTLdefault', handler);
      const tracker = Reflect.getMetadata('THROTTLER:TRACKERdefault', handler);

      expect(limit()).toBe(10);
      expect(ttl()).toBe(60_000);
      expect(tracker).toBe(getAuthenticatedAddressTracker);
    }
  });

  it('rate limits submission mutations per authenticated address', () => {
    for (const handler of [
      SubmissionsController.prototype.create,
      SubmissionsController.prototype.approve,
      SubmissionsController.prototype.reject,
    ]) {
      const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', handler);
      const ttl = Reflect.getMetadata('THROTTLER:TTLdefault', handler);
      const tracker = Reflect.getMetadata('THROTTLER:TRACKERdefault', handler);

      expect(limit()).toBe(20);
      expect(ttl()).toBe(60_000);
      expect(tracker).toBe(getAuthenticatedAddressTracker);
    }
  });
});
