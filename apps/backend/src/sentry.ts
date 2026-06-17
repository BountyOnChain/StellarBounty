import * as Sentry from '@sentry/nestjs';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

const PII_FIELDS = ['signature', 'accessToken', 'secret', 'password', 'token', 'authorization'];

function scrubPII(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(scrubPII);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (PII_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      result[key] = scrubPII(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function initSentry(config: ConfigService): void {
  const dsn = config.get<string>('SENTRY_DSN');

  Sentry.init({
    dsn: dsn || undefined,
    environment: config.get<string>('NODE_ENV', 'development'),
    release: config.get<string>('RELEASE', '0.1.0'),
    tracesSampleRate: 1.0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        event.request = scrubPII(event.request) as typeof event.request;
      }
      if (event.user) {
        const safeUser: Record<string, unknown> = {};
        if (event.user.id) safeUser.id = event.user.id;
        if (event.user.walletAddress) safeUser.walletAddress = event.user.walletAddress;
        event.user = safeUser as typeof event.user;
      }
      return event;
    },
  });
}

export function sentryErrorHandler(req: Request, error: Error): void {
  Sentry.withScope((scope) => {
    scope.setTag('url', req.url);
    scope.setTag('method', req.method);
    scope.setContext('request', {
      url: req.url,
      method: req.method,
      headers: scrubPII(req.headers) as Record<string, unknown>,
    });
    if ((req as any).user?.walletAddress) {
      scope.setUser({ walletAddress: (req as any).user.walletAddress });
    }
    Sentry.captureException(error);
  });
}
