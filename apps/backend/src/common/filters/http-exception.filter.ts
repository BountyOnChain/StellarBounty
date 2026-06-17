import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';
import { Scope } from '@sentry/types';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttp
      ? ((exception.getResponse() as any)?.message ?? exception.message)
      : 'Internal server error';

    if (!isHttp) {
      const errorObj = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `Unhandled exception on ${req.method} ${req.url}`,
        errorObj.stack,
      );
      // Report to Sentry
      Sentry.withScope((scope: Scope) => {
        scope.setTag('url', req.url);
        scope.setTag('method', req.method);
        scope.setContext('request', {
          url: req.url,
          method: req.method,
        });
        Sentry.captureException(errorObj);
      });
    }

    res.status(statusCode).json({
      error: { code: HttpStatus[statusCode] ?? 'INTERNAL_SERVER_ERROR', message, statusCode },
    });
  }
}
