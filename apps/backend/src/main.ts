import 'reflect-metadata';
import * as Sentry from '@sentry/nestjs';
import { randomUUID } from 'crypto';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createCorsOptions } from './cors.config';
import { setupSwagger } from './swagger.setup';
import { createValidationPipeOptions } from './validation-pipe.config';
import { initSentry, sentryErrorHandler } from './sentry';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Initialize Sentry error tracking (gracefully disabled if SENTRY_DSN not set)
  initSentry(config);

  app.use(helmet());
  app.use(compression());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] ?? randomUUID();
    next();
  });
  app.enableCors(createCorsOptions(config));
  app.useGlobalPipes(new ValidationPipe(createValidationPipeOptions()));
  app.useGlobalFilters(new HttpExceptionFilter());

  // Sentry request handler — must be after other middleware but before routes
  app.use(Sentry.Handlers.requestHandler());

  // Sentry error handler — captures unhandled errors
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    sentryErrorHandler(req, err);
    next(err);
  });

  setupSwagger(app);

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
}

bootstrap();
