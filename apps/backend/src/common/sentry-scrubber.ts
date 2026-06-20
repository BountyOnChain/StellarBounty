import type { Event } from '@sentry/nestjs';

const REDACTED = '[Filtered]';
const SENSITIVE_KEY_PATTERN = /authorization|cookie|jwt|nonce|password|privatekey|secret|signature|token/i;

export function scrubSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubSensitiveData(item, depth + 1));
  }

  if (typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : scrubSensitiveData(nestedValue, depth + 1),
    ]),
  );
}

export function scrubSentryEvent<T extends Event>(event: T): T {
  return scrubSensitiveData(event) as T;
}
