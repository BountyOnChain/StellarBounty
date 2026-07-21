"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import BountyGrid from "./BountyGrid";
import { type BountyCardData } from "./BountyCard";

type CursorPage = {
  data: BountyCardData[];
  total: number;
  nextCursor: string | null;
};

type BountyListClientProps = {
  initialData: BountyCardData[];
  initialTotal: number;
  initialNextCursor: string | null;
  baseUrl: string;
  filters: Record<string, string>;
};

export default function BountyListClient({
  initialData,
  initialTotal,
  initialNextCursor,
  baseUrl,
  filters,
}: BountyListClientProps) {
  const [bounties, setBounties] = useState<BountyCardData[]>(initialData);
  const [cursor, setCursor] = useState<string | null>(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  const fetchNextPage = useCallback(async () => {
    if (loadingRef.current || cursor === null) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams(filters);
      params.set("limit", "20");
      if (cursor) params.set("cursor", cursor);

      const url = `${baseUrl}/api/v1/bounties?${params.toString()}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Failed to load bounties (${res.status})`);
      }

      const payload = (await res.json()) as CursorPage;
      setBounties((prev) => [...prev, ...payload.data]);
      setCursor(payload.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bounties");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [cursor, baseUrl, filters]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage]);

  return (
    <div>
      <BountyGrid bounties={bounties} />

      {cursor !== null && (
        <div ref={sentinelRef} className="h-1" aria-hidden="true" />
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-amber-500 dark:border-slate-700 dark:border-t-yellow-400" />
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          {error}
          <button
            onClick={fetchNextPage}
            className="ml-3 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {cursor === null && bounties.length > 0 && (
        <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          You&apos;ve reached the end — {bounties.length} of {initialTotal} bounties loaded.
        </p>
      )}
    </div>
  );
}
