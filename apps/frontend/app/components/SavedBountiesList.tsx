"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/components/WalletContext";
import { useAuth } from "@/lib/api";
import BountyCard, { type BountyCardData } from "./BountyCard";

type SavedBountyItem = {
  bountyId: string;
  title: string;
  rewardAmount?: string | null;
  deadline?: string | null;
  status?: string;
};

export default function SavedBountiesList() {
  const { publicKey } = useWallet();
  const { getToken, apiUrl } = useAuth();
  const [saved, setSaved] = useState<BountyCardData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSaved = useCallback(async () => {
    if (!publicKey) {
      setSaved([]);
      setLoading(false);
      return;
    }

    try {
      const token = await getToken(publicKey);
      const res = await fetch(`${apiUrl}/api/v1/me/saved-bounties`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch saved bounties");
      const data = (await res.json()) as SavedBountyItem[];
      setSaved(
        data.map((item) => ({
          id: item.bountyId,
          title: item.title,
          reward: item.rewardAmount ?? null,
          deadline: item.deadline ?? null,
          status: item.status ?? "open",
        })),
      );
    } catch {
      setSaved([]);
    } finally {
      setLoading(false);
    }
  }, [publicKey, getToken, apiUrl]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  const handleUnsave = useCallback(
    async (bountyId: string) => {
      if (!publicKey) return;
      try {
        const token = await getToken(publicKey);
        await fetch(`${apiUrl}/api/v1/bounties/${bountyId}/save`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        setSaved((prev) => prev.filter((b) => String(b.id) !== bountyId));
      } catch {
        // silently fail
      }
    },
    [publicKey, getToken, apiUrl],
  );

  if (loading) {
    return <p className="text-center text-slate-600">Loading saved bounties...</p>;
  }

  if (!publicKey) {
    return <p className="text-center text-slate-600">Connect your wallet to see saved bounties.</p>;
  }

  if (saved.length === 0) {
    return <p className="text-center text-slate-600">No saved bounties yet.</p>;
  }

  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {saved.map((bounty) => (
        <BountyCard
          key={bounty.id}
          bounty={bounty}
          isSaved={true}
          onToggleSave={handleUnsave}
        />
      ))}
    </section>
  );
}