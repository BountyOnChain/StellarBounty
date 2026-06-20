import * as Sentry from '@sentry/nestjs';
import { scrubSentryEvent } from './common/sentry-scrubber';

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
  release: process.env.SENTRY_RELEASE ?? process.env.GITHUB_SHA,
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
});

