import Link from "next/link";

export type BountyCardData = {
  id: string | number;
  title: string;
  reward?: string | number | null;
  deadline?: string | null;
  status?: string | null;
  category?: string | null;
  tags?: Array<string | { name?: string | null }> | null;
};

type BountyCardProps = {
  bounty: BountyCardData;
};

function formatReward(reward: BountyCardData["reward"]) {
  if (reward === null || reward === undefined || reward === "") {
    return "Reward TBD";
  }

  return typeof reward === "number" ? `${reward.toLocaleString()} XLM` : reward;
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

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeTags(tags: BountyCardData["tags"]) {
  return (tags ?? [])
    .map((tag) => (typeof tag === "string" ? tag : tag.name ?? ""))
    .filter(Boolean)
    .slice(0, 3);
}

export default function BountyCard({ bounty }: BountyCardProps) {
  const status = bounty.status ?? "open";
  const statusLabel = status.replace(/_/g, " ");
  const category = bounty.category ?? "development";
  const tags = normalizeTags(bounty.tags);

  return (
    <Link
      href={`/bounties/${bounty.id}`}
      className="group flex h-full min-w-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:border-yellow-400/60 hover:bg-slate-900 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="line-clamp-2 break-words text-base font-semibold text-slate-100 group-hover:text-yellow-100 sm:text-lg">
          {bounty.title}
        </h2>
        <span className="min-h-7 w-fit shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium capitalize text-emerald-300">
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-xs font-medium text-sky-200">
          {formatLabel(category)}
        </span>
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-xs text-slate-300"
          >
            #{tag}
          </span>
        ))}
      </div>

      <div className="mt-6 flex flex-1 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reward</p>
          <p className="mt-1 break-words text-xl font-bold text-yellow-400 sm:text-2xl">{formatReward(bounty.reward)}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Deadline</p>
          <p className="mt-1 text-sm text-slate-300">{formatDeadline(bounty.deadline)}</p>
        </div>
      </div>
    </Link>
  );
}
