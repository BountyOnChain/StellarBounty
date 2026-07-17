// Sentry must be initialized before any other module is loaded so that its
// automatic instrumentation (http, express, pg, …) can hook require/import.
// This file is imported first in main.ts — keep it dependency-free otherwise.
import { config as loadDotenv } from 'dotenv';
import * as Sentry from '@sentry/nestjs';

// quiet: suppress dotenv's startup banner so backend logs stay pure JSON
loadDotenv({ quiet: true });

const dsn = process.env.SENTRY_DSN;
const tracesSampleRate = Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1');

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
});
