import { ConfigService } from '@nestjs/config';

const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

export function getAllowedCorsOrigins(config: ConfigService): string[] {
  const configuredOrigins =
    config.get<string>('CORS_ORIGINS') ??
    config.get<string>('CORS_ORIGIN') ??
    DEFAULT_CORS_ORIGIN;

  return configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function createCorsOptions(config: ConfigService) {
  const allowedOrigins = getAllowedCorsOrigins(config);

  return {
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    // sentry-trace / baggage carry distributed-tracing context from the frontend
    allowedHeaders: ['Content-Type', 'Authorization', 'sentry-trace', 'baggage'],
  };
}
