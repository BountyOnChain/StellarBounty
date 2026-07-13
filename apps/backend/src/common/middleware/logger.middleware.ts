import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { jsonLogger } from '../json-logger.service';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    const method = req.method;
    const path = req.originalUrl ?? req.url;

    // Return the generated/request requestId to the client for debugging support
    res.set('x-request-id', requestId);

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      jsonLogger.runWithContext({ requestId, method, path }, () => {
        jsonLogger.log(
          {
            msg: 'request',
            method,
            path,
            statusCode: res.statusCode,
            durationMs,
          },
          'HTTP',
        );
      });
    });

    jsonLogger.runWithContext({ requestId, method, path }, () => next());
  }
}
