import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
      const requestId = req.headers['x-request-id'] ?? '-';
      const message = `${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms [${requestId}]`;
      if (req.method === 'GET') {
        this.logger.debug(message);
        return;
      }
      this.logger.log(message);
    });
    next();
  }
}
