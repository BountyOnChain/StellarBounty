"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function SentryTestClient() {
  const [shouldThrow, setShouldThrow] = useState(false);
  const [backendStatus, setBackendStatus] = useState<string | null>(null);

  if (shouldThrow) {
    // Thrown during render so it reaches the error boundary (app/error.tsx),
    // which reports it to Sentry.
    throw new Error("Sentry frontend test error");
  }

  async function triggerBackendError() {
    setBackendStatus("Calling backend…");
    try {
      const res = await fetch(`${API_URL}/api/v1/debug-sentry`);
      setBackendStatus(`Backend responded with HTTP ${res.status} — check Sentry for the event.`);
    } catch {
      setBackendStatus("Request failed — is the backend running?");
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Sentry test page</h1>
      <p className="max-w-md text-sm text-slate-500">
        Each button produces a test exception that should appear as an event in Sentry. This page is
        not available in production builds.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => setShouldThrow(true)}
          className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-500"
        >
          Throw frontend error
        </button>
        <button
          onClick={triggerBackendError}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium transition hover:border-amber-500 dark:border-slate-700"
        >
          Trigger backend error
        </button>
      </div>
      {backendStatus && <p className="text-sm text-slate-500">{backendStatus}</p>}
    </main>
  );
}
