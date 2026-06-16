import { ConfigService } from '@nestjs/config';
import { ThrottlerGetTrackerFunction, ThrottlerModuleOptions } from '@nestjs/throttler';

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_CHALLENGE_LIMIT = 5;
const DEFAULT_VERIFY_LIMIT = 10;
const DEFAULT_BOUNTY_CREATE_LIMIT = 10;
const DEFAULT_SUBMISSION_CREATE_LIMIT = 20;
const DEFAULT_GLOBAL_GET_LIMIT = 100;

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

export function getBountyCreateRateLimit(): number {
  return readPositiveInteger('BOUNTY_CREATE_RATE_LIMIT', DEFAULT_BOUNTY_CREATE_LIMIT);
}

export function getSubmissionCreateRateLimit(): number {
  return readPositiveInteger('SUBMISSION_CREATE_RATE_LIMIT', DEFAULT_SUBMISSION_CREATE_LIMIT);
}

export function getGlobalGetRateLimit(): number {
  return readPositiveInteger('GLOBAL_GET_RATE_LIMIT', DEFAULT_GLOBAL_GET_LIMIT);
}

function getBearerPayload(req: Record<string, any>): Record<string, unknown> | undefined {
  const authorization = req.headers?.authorization;
  if (typeof authorization !== 'string') {
    return undefined;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return undefined;
  }

  const [, payload] = token.split('.');
  if (!payload) {
    return undefined;
  }

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
  } catch {
    return undefined;
  }
}

export const getAuthenticatedAddressTracker: ThrottlerGetTrackerFunction = (
  req: Record<string, any>,
) => {
  const payload = getBearerPayload(req);
  const address = payload?.sub;

  if (typeof address === 'string' && address.length > 0) {
    return address;
  }

  return req.ip ?? req.headers?.['x-forwarded-for'] ?? 'unknown';
};

export function createApiThrottleOptions(
  config: ConfigService,
): ThrottlerModuleOptions {
  return {
    errorMessage: 'Too many requests. Please wait before trying again.',
    throttlers: [{
      ttl: config.get<number>('AUTH_RATE_LIMIT_TTL_MS', DEFAULT_TTL_MS),
      limit: config.get<number>('GLOBAL_GET_RATE_LIMIT', DEFAULT_GLOBAL_GET_LIMIT),
    }],
  };
}

export const createAuthThrottleOptions = createApiThrottleOptions;
