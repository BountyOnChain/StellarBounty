"use client";

import Link from "next/link";
import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Unhandled page error:", error);
  }, [error]);

  return (
    <main className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center bg-slate-50 px-4 text-center text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <h1 className="text-7xl font-black tracking-tight text-red-500/50">500</h1>
      <p className="mt-4 text-lg text-slate-700 dark:text-slate-300">Something went wrong</p>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      {error.digest && (
        <p className="mt-1 font-mono text-xs text-slate-600">
          Error ID: {error.digest}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-amber-500 hover:text-amber-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-yellow-400 dark:hover:text-yellow-300"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
