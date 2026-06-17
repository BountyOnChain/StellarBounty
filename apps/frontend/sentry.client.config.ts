import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "",
  environment: process.env.NODE_ENV || "development",
  release: process.env.NEXT_PUBLIC_RELEASE || "0.1.0",
  tracesSampleRate: 1.0,
  sendDefaultPii: false,
  beforeSend(event) {
    // Scrub PII from error reports
    if (event.request) {
      const headers = event.request.headers as Record<string, string> | undefined;
      if (headers) {
        for (const key of Object.keys(headers)) {
          if (
            key.toLowerCase().includes("authorization") ||
            key.toLowerCase().includes("cookie")
          ) {
            headers[key] = "[REDACTED]";
          }
        }
      }
    }
    return event;
  },
});
