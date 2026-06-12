import BountyDetailClient from "./BountyDetailClient";

type Bounty = {
  id: string;
  title: string;
  description: string;
  reward: string;
  deadline: string;
  status: "open" | "in-progress" | "in_progress" | "completed" | "cancelled";
  ownerAddress: string;
};

type ApiBounty = Partial<Omit<Bounty, "reward" | "deadline">> & {
  reward?: string | number | null;
  rewardAmount?: string | number | null;
  amount?: string | number | null;
  deadline?: string | null;
  dueDate?: string | null;
};
type ApiBountiesResponse = ApiBounty[] | { data?: ApiBounty[] };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function normalizeBounty(bounty: ApiBounty): Bounty | null {
  if (!bounty.id || !bounty.title || !bounty.description || !bounty.ownerAddress) {
    return null;
  }

  return {
    id: bounty.id,
    title: bounty.title,
    description: bounty.description,
    reward: String(bounty.reward ?? bounty.rewardAmount ?? bounty.amount ?? "0"),
    deadline: bounty.deadline ?? bounty.dueDate ?? "No deadline",
    status: bounty.status ?? "open",
    ownerAddress: bounty.ownerAddress,
  };
}

async function getBounty(id: string): Promise<Bounty | null> {
  try {
    const response = await fetch(`${API_URL}/bounties/${encodeURIComponent(id)}`, { next: { revalidate: 60 } });

    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
      return null;
    }

    return normalizeBounty((await response.json()) as ApiBounty);
  } catch {
    return null;
  }
}

export async function generateStaticParams() {
  try {
    const response = await fetch(`${API_URL}/bounties`, { next: { revalidate: 60 } });

    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
      return [];
    }

    const payload = (await response.json()) as ApiBountiesResponse;
    const bounties = Array.isArray(payload) ? payload : payload.data ?? [];

    return bounties.flatMap((bounty) => (bounty.id ? [{ id: bounty.id }] : []));
  } catch {
    return [];
  }
}

export default async function BountyDetailPage({ params }: { params: { id: string } }) {
  const bounty = await getBounty(params.id);

  if (!bounty) {
    return (
      <main className="min-h-[calc(100vh-73px)] bg-slate-950 px-4 py-10 text-slate-100">
        <section className="mx-auto max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <h1 className="text-2xl font-bold text-white">Bounty unavailable</h1>
          <p className="mt-3 text-slate-300">
            The bounty could not be loaded from the API. Please try again once the backend is available.
          </p>
        </section>
      </main>
    );
  }

  return <BountyDetailClient bounty={bounty} />;
}
