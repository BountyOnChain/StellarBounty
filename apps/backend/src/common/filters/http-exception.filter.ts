import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
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
    const message = isHttp
      ? ((exception.getResponse() as any)?.message ?? exception.message)
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
      error: {
        code: (isHttp && typeof exception.getResponse() === 'object'
          ? (exception.getResponse() as Record<string, unknown>)?.code
          : undefined) as string | undefined ?? HttpStatus[statusCode] ?? 'INTERNAL_SERVER_ERROR',
        message,
        ...((isHttp && typeof exception.getResponse() === 'object')
          ? Object.fromEntries(
              Object.entries(exception.getResponse() as Record<string, unknown>)
                .filter(([key]) => key !== 'message' && key !== 'statusCode' && key !== 'error'),
            )
          : {}),
        statusCode,
      },
    });
  }
}
