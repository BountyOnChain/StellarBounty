"use client";

import Link from "next/link";
import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Categorise an error so we can show a helpful, contextual message.
 */
function categoriseError(error: Error): {
  title: string;
  description: string;
  icon: string;
} {
  const msg = error.message?.toLowerCase() ?? "";

  if (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("econnrefused") ||
    msg.includes("timeout") ||
    msg.includes("abort")
  ) {
    return {
      title: "Network error",
      description:
        "We couldn't reach our servers. This can happen when your connection is unstable or the service is temporarily unavailable.",
      icon: "🌐",
    };
  }

  if (
    msg.includes("unauthorised") ||
    msg.includes("unauthorized") ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("not authenticated")
  ) {
    return {
      title: "Authentication error",
      description:
        "Your session may have expired. Please sign in again and try once more.",
      icon: "🔒",
    };
  }

  if (
    msg.includes("not found") ||
    msg.includes("404") ||
    msg.includes("missing")
  ) {
    return {
      title: "Resource not found",
      description: "The data you requested could not be found. It may have been moved or deleted.",
      icon: "🔍",
    };
  }

  if (
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("too many")
  ) {
    return {
      title: "Rate limit reached",
      description:
        "You've made too many requests in a short time. Please wait a moment and try again.",
      icon: "⏳",
    };
  }

  if (
    msg.includes("validation") ||
    msg.includes("invalid") ||
    msg.includes("malformed")
  ) {
    return {
      title: "Validation error",
      description:
        "Some data didn't pass validation. This is likely a bug — please report it.",
      icon: "⚠️",
    };
  }

  // Default — generic server / client error
  return {
    title: "Something went wrong",
    description:
      "An unexpected error occurred. Please try again, or come back later if the issue persists.",
    icon: "💥",
  };
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const { title, description, icon } = categoriseError(error);

  useEffect(() => {
    console.error("[ErrorBoundary]", error);
  }, [error]);

  return (
    <main className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center bg-slate-50 px-4 text-center text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <span className="text-6xl" role="img" aria-hidden>
        {icon}
      </span>
      <h1 className="mt-4 text-7xl font-black tracking-tight text-red-500/50">
        500
      </h1>
      <p className="mt-4 text-lg font-semibold text-slate-700 dark:text-slate-300">
        {title}
      </p>
      <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>

      {error.digest && (
        <p className="mt-3 font-mono text-xs text-slate-400">
          Error ID: {error.digest}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-amber-500 hover:text-amber-700 dark:border-slate-700 dark:bg-transparent dark:text-slate-200 dark:hover:border-yellow-400 dark:hover:text-yellow-300"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}