"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────
interface Bounty {
  id: string;
  title: string;
  reward: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
  deadline: string;
  tags: string[];
  creator: string;
}

interface Submission {
  id: string;
  bountyTitle: string;
  bountyId: string;
  submittedAt: string;
  status: "pending" | "accepted" | "rejected";
}

// ─── Helpers ─────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadge(
  status: string,
  type: "bounty" | "submission"
): React.ReactNode {
  const styles: Record<string, string> = {
    open: "bg-green-100 text-green-700 border-green-200",
    in_progress: "bg-yellow-100 text-yellow-700 border-yellow-200",
    completed: "bg-blue-100 text-blue-700 border-blue-200",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200",
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    accepted: "bg-green-100 text-green-700 border-green-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };

  const labels: Record<string, string> = {
    open: "Open",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
    pending: "Pending Review",
    accepted: "Accepted",
    rejected: "Rejected",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        styles[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

// ─── Skeleton Loader ─────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="animate-pulse border-b border-gray-100 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-48 rounded bg-gray-200" />
          <div className="h-3 w-32 rounded bg-gray-100" />
        </div>
        <div className="h-6 w-20 rounded-full bg-gray-200" />
      </div>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────
function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 text-5xl">{icon}</span>
      <h3 className="mb-1 text-lg font-medium text-gray-900">{title}</h3>
      <p className="max-w-sm text-sm text-gray-500">{description}</p>
    </div>
  );
}

// ─── Tab Config ──────────────────────────────────────────────────
type TabId = "submissions" | "bounties";

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: "submissions", label: "My Submissions", icon: "📝" },
  { id: "bounties", label: "My Bounties", icon: "🏆" },
];

// ─── Dashboard Component ────────────────────────────────────────
export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("submissions");
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bountyRes, submissionRes] = await Promise.all([
        fetch("/api/bounties?my=true"),
        fetch("/api/submissions?my=true"),
      ]);

      if (!bountyRes.ok) throw new Error("Failed to fetch bounties");
      if (!submissionRes.ok) throw new Error("Failed to fetch submissions");

      const bountyData = await bountyRes.json();
      const submissionData = await submissionRes.json();

      setBounties(Array.isArray(bountyData) ? bountyData : bountyData.items || []);
      setSubmissions(
        Array.isArray(submissionData) ? submissionData : submissionData.items || []
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track your submissions and bounties
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.id === "submissions" && submissions.length > 0 && (
              <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600">
                {submissions.length}
              </span>
            )}
            {tab.id === "bounties" && bounties.length > 0 && (
              <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-600">
                {bounties.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>⚠️</span>
          <span>{error}</span>
          <button
            onClick={fetchData}
            className="ml-auto rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Content Panel */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Tab: My Submissions */}
        {activeTab === "submissions" && (
          <div>
            {/* Header */}
            <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-3">
              <div className="grid grid-cols-12 text-xs font-medium uppercase tracking-wider text-gray-400">
                <span className="col-span-6">Submission</span>
                <span className="col-span-3">Submitted</span>
                <span className="col-span-3 text-right">Status</span>
              </div>
            </div>

            {/* Loading */}
            {loading && (
              <div>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            )}

            {/* Empty */}
            {!loading && submissions.length === 0 && (
              <EmptyState
                icon="📝"
                title="No submissions yet"
                description="Submit a solution to a bounty and it will appear here."
              />
            )}

            {/* List */}
            {!loading &&
              submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="border-b border-gray-50 px-6 py-4 transition-colors last:border-b-0 hover:bg-gray-50/50"
                >
                  <div className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-6">
                      <Link
                        href={`/bounties/${sub.bountyId}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600"
                      >
                        {sub.bountyTitle}
                      </Link>
                      <p className="text-xs text-gray-400">
                        ID: {sub.id.slice(0, 8)}...
                      </p>
                    </div>
                    <div className="col-span-3">
                      <span className="text-sm text-gray-500">
                        {formatDate(sub.submittedAt)}
                      </span>
                    </div>
                    <div className="col-span-3 flex justify-end">
                      {statusBadge(sub.status, "submission")}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Tab: My Bounties */}
        {activeTab === "bounties" && (
          <div>
            {/* Header */}
            <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-3">
              <div className="grid grid-cols-12 text-xs font-medium uppercase tracking-wider text-gray-400">
                <span className="col-span-5">Bounty</span>
                <span className="col-span-2">Reward</span>
                <span className="col-span-3">Deadline</span>
                <span className="col-span-2 text-right">Status</span>
              </div>
            </div>

            {/* Loading */}
            {loading && (
              <div>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            )}

            {/* Empty */}
            {!loading && bounties.length === 0 && (
              <EmptyState
                icon="🏆"
                title="No bounties created"
                description="Create your first bounty and it will appear here."
              />
            )}

            {/* List */}
            {!loading &&
              bounties.map((bounty) => (
                <div
                  key={bounty.id}
                  className="border-b border-gray-50 px-6 py-4 transition-colors last:border-b-0 hover:bg-gray-50/50"
                >
                  <div className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-5">
                      <Link
                        href={`/bounties/${bounty.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600"
                      >
                        {bounty.title}
                      </Link>
                      {bounty.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {bounty.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                            >
                              {tag}
                            </span>
                          ))}
                          {bounty.tags.length > 3 && (
                            <span className="text-xs text-gray-400">
                              +{bounty.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-gray-900">
                        {bounty.reward} XLM
                      </span>
                    </div>
                    <div className="col-span-3">
                      <span className="text-sm text-gray-500">
                        {formatDate(bounty.deadline)}
                      </span>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {statusBadge(bounty.status, "bounty")}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div className="mt-4 text-center">
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <svg
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {loading ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>
    </div>
  );
}
