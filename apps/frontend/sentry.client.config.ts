// Initializes Sentry in the browser. Loaded automatically by @sentry/nextjs
// via the webpack injection performed in withSentryConfig (next.config.mjs).
import * as Sentry from "@sentry/nextjs";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NODE_ENV,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // Attach sentry-trace/baggage headers to fetches against the backend so
  // traces continue frontend → backend → Stellar RPC.
  tracePropagationTargets: ["localhost", apiUrl],
});
