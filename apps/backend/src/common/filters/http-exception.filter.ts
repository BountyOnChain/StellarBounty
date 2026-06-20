import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { jsonLogger } from '../json-logger.service';

type HttpExceptionResponse = {
  message?: unknown;
};

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
      ? (typeof response === 'object' && response !== null
          ? (response as HttpExceptionResponse).message ?? exception.message
          : response ?? exception.message)
      : 'Internal server error';

    if (!isHttp) {
      jsonLogger.mergeContext({ method: req.method, path: req.originalUrl ?? req.url });
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
}
