"use client";

/**
 * Global error boundary (Next.js convention).
 * Catches errors thrown in the root layout itself — unlike `error.tsx`
 * which lives inside the layout and cannot catch errors from the layout.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
        <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
          <span className="text-6xl" role="img" aria-hidden>
            🚨
          </span>
          <h1 className="mt-4 text-7xl font-black tracking-tight text-red-500/50">
            Critical error
          </h1>
          <p className="mt-4 max-w-md text-sm text-slate-500">
            The application encountered a critical error from which it could not
            recover. This is usually caused by a problem with the application
            shell itself.
          </p>
          {error.digest && (
            <p className="mt-3 font-mono text-xs text-slate-400">
              Error ID: {error.digest}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={reset}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500"
            >
              Try again
            </button>
            <a
              href="/"
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-amber-500 hover:text-amber-700 dark:border-slate-700 dark:bg-transparent dark:text-slate-200 dark:hover:border-yellow-400 dark:hover:text-yellow-300"
            >
              Reload page
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}