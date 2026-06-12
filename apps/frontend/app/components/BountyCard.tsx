import Link from "next/link";

export type BountyCardData = {
  id: string | number;
  title: string;
  reward?: string | number | null;
  deadline?: string | null;
  status?: string | null;
};

type BountyCardProps = {
  bounty: BountyCardData;
  highlight?: string;
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

function HighlightedText({ text, query }: { text: string; query?: string }) {
  const normalizedQuery = query?.trim();
  if (!normalizedQuery) {
    return <>{text}</>;
  }

  const matchIndex = text.toLowerCase().indexOf(normalizedQuery.toLowerCase());
  if (matchIndex === -1) {
    return <>{text}</>;
  }

  return (
    <>
      {text.slice(0, matchIndex)}
      <mark className="rounded bg-yellow-300 px-0.5 text-slate-950">
        {text.slice(matchIndex, matchIndex + normalizedQuery.length)}
      </mark>
      {text.slice(matchIndex + normalizedQuery.length)}
    </>
  );
}

export default function BountyCard({ bounty, highlight }: BountyCardProps) {
  const status = bounty.status ?? "open";
  const statusLabel = status.replace(/_/g, " ");

  return (
    <Link
      href={`/bounties/${bounty.id}`}
      className="group flex h-full min-w-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:border-yellow-400/60 hover:bg-slate-900 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="line-clamp-2 break-words text-base font-semibold text-slate-100 group-hover:text-yellow-100 sm:text-lg">
          <HighlightedText text={bounty.title} query={highlight} />
        </h2>
        <span className="min-h-7 w-fit shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium capitalize text-emerald-300">
          {statusLabel}
        </span>
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
