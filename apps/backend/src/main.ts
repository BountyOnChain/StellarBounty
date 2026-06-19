import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { ValidationPipe, Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JsonLoggerService, jsonLogger } from './common/json-logger.service';
import { createCorsOptions } from './cors.config';
import { createContentSecurityPolicy } from './csp.config';
import { createGracefulShutdownHandler } from './graceful-shutdown';
import { setupSwagger } from './swagger.setup';
import { createValidationPipeOptions } from './validation-pipe.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(jsonLogger);
  // Make Nest's internal bootstrap output go through the JSON logger too
  NestLogger.overrideLogger(jsonLogger as unknown as JsonLoggerService);
  const config = app.get(ConfigService);

  // Request body size limits — DoS protection (#158)
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ limit: '100kb', extended: true }));

  app.use(helmet({ contentSecurityPolicy: createContentSecurityPolicy(config) }));
  // HSTS: force HTTPS in production (1 year, includeSubDomains, preload)
  if (config.get<string>('NODE_ENV') === 'production') {
    app.use(
      helmet.hsts({
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      }),
    );
    // Redirect HTTP to HTTPS
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.headers['x-forwarded-proto'] !== 'https') {
        res.redirect(301, `https://${req.headers.host}${req.url}`);
        return;
      }
      next();
    });
  }
  app.use(compression());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] ?? randomUUID();
    next();
  });
  app.enableCors(createCorsOptions(config));
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe(createValidationPipeOptions()));
  app.useGlobalFilters(new HttpExceptionFilter());
  setupSwagger(app);

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
  app.enableShutdownHooks();

  const shutdown = createGracefulShutdownHandler(app, { logger: jsonLogger });
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  jsonLogger.log(`Backend listening on port ${port}`, 'Bootstrap');
}

bootstrap();
