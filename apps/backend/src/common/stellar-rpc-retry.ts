import { Logger } from '@nestjs/common';

type RetryLogger = Pick<Logger, 'warn'>;

export type StellarRpcRetryEvent = {
  operation: string;
  attempt: number;
  error: unknown;
  retryable: boolean;
};

type StellarRpcRetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  jitterRatio?: number;
  logger?: RetryLogger;
  sleep?: (delayMs: number) => Promise<void>;
  random?: () => number;
  onFailure?: (event: StellarRpcRetryEvent) => void;
  onRetry?: (event: StellarRpcRetryEvent & { delayMs: number; nextAttempt: number }) => void;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_JITTER_RATIO = 0.25;

const RETRYABLE_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENETDOWN',
  'ENETRESET',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

export async function withStellarRpcRetry<T>(
  operation: string,
  fn: () => Promise<T>,
  options: StellarRpcRetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const retryable = isRetryableStellarRpcError(error);
      const event = { operation, attempt, error, retryable };
      options.onFailure?.(event);

      if (!retryable || attempt > maxRetries) {
        throw error;
      }

      const delayMs = calculateBackoffDelay(attempt, options);
      options.logger?.warn(
        `Stellar RPC ${operation} failed on attempt ${attempt}; retrying attempt ${attempt + 1}/${maxRetries + 1} in ${delayMs}ms: ${formatError(error)}`,
      );
      options.onRetry?.({ ...event, delayMs, nextAttempt: attempt + 1 });
      await sleep(delayMs);
    }
  }
}

export function isRetryableStellarRpcError(error: unknown): boolean {
  const status = extractStatus(error);
  if (status !== undefined) {
    return status >= 500 && status <= 599;
  }

  const code = extractStringField(error, 'code');
  if (code && RETRYABLE_ERROR_CODES.has(code)) {
    return true;
  }

  const name = extractStringField(error, 'name');
  if (name === 'AbortError' || name === 'TimeoutError') {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /\b(fetch failed|network|socket|timeout|timed out|temporarily unavailable)\b/i.test(message);
}

function calculateBackoffDelay(attempt: number, options: StellarRpcRetryOptions): number {
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const jitterRatio = options.jitterRatio ?? DEFAULT_JITTER_RATIO;
  const random = options.random ?? Math.random;
  const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);
  const jitter = 1 + (random() * 2 - 1) * jitterRatio;

  return Math.max(0, Math.round(exponentialDelay * jitter));
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function extractStatus(error: unknown): number | undefined {
  const directStatus = extractNumberField(error, 'status') ?? extractNumberField(error, 'statusCode');
  if (directStatus !== undefined) {
    return directStatus;
  }

  const response = extractObjectField(error, 'response');
  return extractNumberField(response, 'status') ?? extractNumberField(response, 'statusCode');
}

function extractNumberField(value: unknown, field: string): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const fieldValue = value[field];
  return typeof fieldValue === 'number' ? fieldValue : undefined;
}

function extractStringField(value: unknown, field: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const fieldValue = value[field];
  return typeof fieldValue === 'string' ? fieldValue : undefined;
}

function extractObjectField(value: unknown, field: string): unknown {
  if (!isRecord(value)) {
    return undefined;
  }

  return value[field];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
