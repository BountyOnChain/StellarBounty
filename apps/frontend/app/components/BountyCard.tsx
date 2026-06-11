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

  return new Date(deadline).toLocaleString();
}

function BountyCard({ bounty }: BountyCardProps) {
  return (
    <Link href={`/bounties/${bounty.id}`} className="block rounded-3xl bg-slate-900 p-6 shadow-2xl shadow-black/20">
      <h2 className="text-2xl font-bold text-white">{bounty.title}</h2>
      <p className="mt-2 text-base text-slate-400">{formatReward(bounty.reward)}</p>
      <p className="mt-2 text-base text-slate-400">{formatDeadline(bounty.deadline)}</p>
      <p className="mt-2 text-base text-slate-400">{bounty.status}</p>
    </Link>
  );
}

export default BountyCard;