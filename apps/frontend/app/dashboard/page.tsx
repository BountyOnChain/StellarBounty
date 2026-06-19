"use client";

import { useEffect, useState } from "react";
import { useWallet } from "../../components/WalletContext";
import { StatusBadge } from "../../components/StatusBadge";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type SubmissionStatus = "pending" | "approved" | "rejected";
type BountyStatus = "open" | "in_progress" | "completed" | "cancelled";

type Submission = {
  id: string;
  bountyTitle: string;
  createdAt: string;
  status: SubmissionStatus;
};

type Bounty = {
  id: string;
  title: string;
  rewardAmount: string;
  openSubmissionCount: number;
  status: BountyStatus;
};

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-slate-500 text-sm">{message}</div>
  );
}

export default function DashboardPage() {
  const { publicKey, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<"submissions" | "bounties">("submissions");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${API_URL}/submissions?contributor=${publicKey}`).then((r) => r.json()),
      fetch(`${API_URL}/api/v1/bounties?owner=${publicKey}`).then((r) => r.json()),
    ])
      .then(([subs, bounts]) => {
        setSubmissions(subs);
        setBounties(bounts);
      })
      .catch(() => setError("Failed to load dashboard data."))
      .finally(() => setLoading(false));
  }, [publicKey]);

  if (!publicKey) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-400">
        <p>Connect your wallet to view your dashboard.</p>
        <button
          onClick={connect}
          className="rounded-md bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-300 transition"
        >
          Connect wallet
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 mb-6">
        {(["submissions", "bounties"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab === "submissions" ? "My Submissions" : "My Bounties"}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 rounded bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : activeTab === "submissions" ? (
        submissions.length === 0 ? (
          <EmptyState message="You haven't submitted to any bounties yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase border-b border-slate-700">
                <tr>
                  <th className="py-3 pr-4">Bounty</th>
                  <th className="py-3 pr-4">Submitted</th>
                  <th className="py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 pr-4 text-slate-100">{s.bountyTitle}</td>
                    <td className="py-3 pr-4 text-slate-400">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : bounties.length === 0 ? (
        <EmptyState message="You haven't created any bounties yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase border-b border-slate-700">
              <tr>
                <th className="py-3 pr-4">Title</th>
                <th className="py-3 pr-4">Reward</th>
                <th className="py-3 pr-4">Submissions</th>
                <th className="py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {bounties.map((b) => (
                <tr key={b.id}>
                  <td className="py-3 pr-4 text-slate-100">{b.title}</td>
                  <td className="py-3 pr-4 text-slate-400">{b.rewardAmount} XLM</td>
                  <td className="py-3 pr-4 text-slate-400">{b.openSubmissionCount}</td>
                  <td className="py-3">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
