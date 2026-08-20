import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { jsonLogger } from '../json-logger.service';

const SENSITIVE_QUERY_KEYS = ['token', 'code', 'apikey', 'api_key', 'secret'];

function sanitizeUrl(originalUrl: string): string {
  const questionIndex = originalUrl.indexOf('?');
  if (questionIndex === -1) return originalUrl;

  const base = originalUrl.slice(0, questionIndex);
  const queryString = originalUrl.slice(questionIndex + 1);
  const params = new URLSearchParams(queryString);

  for (const key of SENSITIVE_QUERY_KEYS) {
    if (params.has(key)) {
      params.set(key, '[REDACTED]');
    }
  }

  const sanitized = params.toString();
  return sanitized ? `${base}?${sanitized}` : base;
}

@Injectable()
export class AuditLogMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const method = req.method;
    const path = sanitizeUrl(req.originalUrl ?? req.url);
    const ip = req.ip;
    const userAgent = req.get('user-agent') || 'unknown';

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const statusCode = res.statusCode;

      const entry = {
        msg: 'http_audit',
        method,
        path,
        statusCode,
        durationMs,
        ip,
        userAgent,
      };

      if (statusCode >= 400) {
        jsonLogger.warn(entry, 'AUDIT');
      } else {
        jsonLogger.log(entry, 'AUDIT');
      }
    });

    next();
  }
}
