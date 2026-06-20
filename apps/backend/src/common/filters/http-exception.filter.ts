import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Request, Response } from 'express';
import { jsonLogger } from '../json-logger.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const response = isHttp ? exception.getResponse() : undefined;
    const message = isHttp
      ? (typeof response === 'object' && response !== null && 'message' in response
        ? response.message
        : exception.message)
      : 'Internal server error';

    if (!isHttp) {
      jsonLogger.mergeContext({ method: req.method, path: req.originalUrl ?? req.url });
      this.captureUnhandledException(exception, req);
      jsonLogger.error(
        `Unhandled exception on ${req.method} ${req.url}`,
        exception instanceof Error ? exception.stack : String(exception),
        HttpExceptionFilter.name,
      );
    }

    res.status(statusCode).json({
      error: { code: HttpStatus[statusCode] ?? 'INTERNAL_SERVER_ERROR', message, statusCode },
    });
  }

  private captureUnhandledException(exception: unknown, req: Request): void {
    const user = (req as Request & { user?: { address?: string; sub?: string } }).user;

    Sentry.withScope((scope) => {
      scope.setContext('request', {
        method: req.method,
        url: req.originalUrl ?? req.url,
        requestId: req.headers['x-request-id'],
      });

      const address = user?.address ?? user?.sub;
      if (address) {
        scope.setUser({ id: address });
      }

      Sentry.captureException(exception);
    });
  }
}
