import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { ValidationPipe, Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JsonLoggerService, jsonLogger } from './common/json-logger.service';
import { createCorsOptions } from './cors.config';
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

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
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
  jsonLogger.log(`Backend listening on port ${port}`, 'Bootstrap');
}

bootstrap();
