"use client";

import Link from "next/link";
import { formatRewardXLM } from "@/lib/stellar-amount";

export type BountyCardData = {
  id: string | number;
  title: string;
  reward?: string | number | null;
  deadline?: string | null;
  status?: string | null;
};

type BountyCardProps = {
  bounty: BountyCardData;
  isSaved?: boolean;
  onToggleSave?: (id: string) => void;
};

function formatReward(reward: BountyCardData["reward"]) {
  if (reward === null || reward === undefined || reward === "") {
    return "Reward TBD";
  }

  if (typeof reward === "number" || typeof reward === "string") {
    return formatRewardXLM(reward);
  }

  return "Reward TBD";
}

function formatDeadline(deadline: BountyCardData["deadline"]) {
  if (!deadline) {
    return "No deadline";
  }

  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) {
    return deadline;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 transition-colors ${
        filled ? "text-red-500" : "text-slate-400 hover:text-red-400"
      }`}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export default function BountyCard({ bounty, isSaved, onToggleSave }: BountyCardProps) {
  const status = bounty.status ?? "open";
  const statusLabel = status.replace(/_/g, " ");

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleSave?.(String(bounty.id));
  };

  return (
    <div className="relative">
      <Link
        href={`/bounties/${bounty.id}`}
        className="group flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60 transition hover:-translate-y-1 hover:border-amber-400 hover:bg-amber-50/40 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-black/10 dark:hover:border-yellow-400/60 dark:hover:bg-slate-900 sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="line-clamp-2 break-words text-base font-semibold text-slate-950 group-hover:text-amber-800 dark:text-slate-100 dark:group-hover:text-yellow-100 sm:text-lg">
            {bounty.title}
          </h2>
          <span className="min-h-7 w-fit shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium capitalize text-emerald-700 dark:text-emerald-300">
            {statusLabel}
          </span>
        </div>

        <div className="mt-6 flex flex-1 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reward</p>
            <p className="mt-1 break-words text-xl font-bold text-amber-600 dark:text-yellow-400 sm:text-2xl">{formatReward(bounty.reward)}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Deadline</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{formatDeadline(bounty.deadline)}</p>
          </div>
        </div>
      </Link>
      {onToggleSave && (
        <button
          type="button"
          onClick={handleSave}
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 backdrop-blur-sm transition hover:scale-110"
          aria-label={isSaved ? "Unsave bounty" : "Save bounty"}
        >
          <HeartIcon filled={!!isSaved} />
        </button>
      )}
    </div>
  );
}