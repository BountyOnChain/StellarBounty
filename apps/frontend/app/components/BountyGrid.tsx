"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletContext";
import { useAuth } from "@/lib/api";
import BountyCard, { type BountyCardData } from "./BountyCard";

type BountyGridProps = {
  bounties: BountyCardData[];
};

export default function BountyGrid({ bounties }: BountyGridProps) {
  const { publicKey, dashboardVersion } = useWallet();
  const { getToken, apiUrl } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const fetchSaved = useCallback(async () => {
    if (!publicKey) {
      setSavedIds(new Set());
      return;
    }

    try {
      const token = await getToken(publicKey);
      const res = await fetch(`${apiUrl}/api/v1/me/saved-bounties`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Fetch failed");
      const data = (await res.json()) as { bountyId: string }[];
      setSavedIds(new Set(data.map((d) => d.bountyId)));
    } catch {
      setSavedIds(new Set());
    }
  }, [publicKey, getToken, apiUrl]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved, dashboardVersion]);

  const handleToggleSave = useCallback(
    async (bountyId: string) => {
      if (!publicKey) return;
      const wasSaved = savedIds.has(bountyId);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(bountyId);
        else next.add(bountyId);
        return next;
      });

      try {
        const token = await getToken(publicKey);
        await fetch(`${apiUrl}/api/v1/bounties/${bountyId}/save`, {
          method: wasSaved ? "DELETE" : "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(bountyId);
          else next.delete(bountyId);
          return next;
        });
      }
    },
    [publicKey, savedIds, getToken, apiUrl],
  );

  if (bounties.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center transition-colors dark:border-slate-700 dark:bg-slate-900/50">
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-200">No bounties available yet.</p>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Create the first bounty and bring new work onto Stellar.</p>
        <Link
          href="/bounties/new"
          className="mt-6 inline-flex rounded-xl border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:border-amber-500 hover:text-amber-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-yellow-400 dark:hover:text-yellow-300"
        >
          Post a bounty
        </Link>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {bounties.map((bounty) => (
        <BountyCard
          key={bounty.id}
          bounty={bounty}
          isSaved={savedIds.has(String(bounty.id))}
          onToggleSave={handleToggleSave}
        />
      ))}
    </section>
  );
}