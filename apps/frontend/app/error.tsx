"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "../lib/i18n";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("Unhandled page error:", error);
  }, [error]);

  return (
    <main className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
      <h1 className="text-7xl font-black tracking-tight text-red-500/50">500</h1>
      <p className="mt-4 text-lg text-slate-300">{t("error.title")}</p>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        {error.message || t("error.body")}
      </p>
      {error.digest && (
        <p className="mt-1 font-mono text-xs text-slate-600">
          {t("error.id", { digest: error.digest })}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          {t("error.tryAgain")}
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-yellow-400 hover:text-yellow-300"
        >
          {t("error.goHome")}
        </Link>
      </div>
    </main>
  );
}
