"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Catches errors thrown by the root layout, where app/error.tsx cannot run.
// Must render its own <html>/<body> because it replaces the root layout.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
        <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
          <h1 className="text-7xl font-black tracking-tight text-red-500/50">500</h1>
          <p className="mt-4 text-lg text-slate-700 dark:text-slate-300">Something went wrong</p>
          {error.digest && (
            <p className="mt-1 font-mono text-xs text-slate-600">Error ID: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
