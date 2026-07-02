import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { jsonLogger } from '../json-logger.service';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? '-';
    const method = req.method;
    const path = req.originalUrl ?? req.url;

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      jsonLogger.log({
        msg: 'request',
        method,
        path,
        statusCode: res.statusCode,
        durationMs,
      }, 'HTTP');
    });

    jsonLogger.runWithContext({ requestId, method, path }, () => next());
  }
}
