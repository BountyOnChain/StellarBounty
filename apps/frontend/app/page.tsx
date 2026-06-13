import type { Metadata } from "next";
import Link from "next/link";
import BountyCard, { type BountyCardData } from "@/app/components/BountyCard";
import { absoluteUrl, defaultDescription, siteName } from "./seo";
import BountyFilters from "@/app/components/BountyFilters";
import LocalizedText from "@/app/components/LocalizedText";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Open Bounties",
  description: defaultDescription,
  alternates: {
    canonical: absoluteUrl(),
  },
  openGraph: {
    title: `Open Bounties | ${siteName}`,
    description: defaultDescription,
    url: absoluteUrl(),
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Open Bounties | ${siteName}`,
    description: defaultDescription,
  },
};

type SortOption = "newest" | "highest_reward" | "closest_deadline";
type StatusFilter = "all" | "open" | "in_progress" | "completed";

type SearchParams = {
  sort?: string;
  status?: string;
  search?: string;
};

type ApiBounty = Partial<BountyCardData> & {
  _id?: string;
  amount?: string | number | null;
  rewardAmount?: string | number | null;
  dueDate?: string | null;
};

type ApiBountiesResponse = ApiBounty[] | { data?: ApiBounty[] };

async function getBounties(): Promise<BountyCardData[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  try {
    const response = await fetch(`${apiUrl}/bounties`, { next: { revalidate } });

    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
      return [];
    }

    const payload = (await response.json()) as ApiBountiesResponse;
    const bounties = Array.isArray(payload) ? payload : payload.data ?? [];

    return bounties.map((bounty, index) => ({
      id: bounty.id ?? bounty._id ?? index,
      title: bounty.title ?? "",
      reward: bounty.reward ?? bounty.rewardAmount ?? bounty.amount ?? null,
      deadline: bounty.deadline ?? bounty.dueDate ?? null,
      status: bounty.status ?? "open",
    }));
  } catch {
    return [];
  }
}

function getRewardValue(reward: BountyCardData["reward"]) {
  if (typeof reward === "number") {
    return reward;
  }

  if (typeof reward === "string") {
    const numericValue = Number.parseFloat(reward.replace(/[^0-9.]/g, ""));
    return Number.isFinite(numericValue) ? numericValue : -1;
  }

  return -1;
}

function getDeadlineValue(deadline: BountyCardData["deadline"]) {
  if (!deadline) {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = new Date(deadline).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function normalizeSort(sort?: string): SortOption {
  if (sort === "highest_reward" || sort === "closest_deadline") {
    return sort;
  }

  return "newest";
}

function normalizeStatus(status?: string): StatusFilter {
  if (status === "open" || status === "in_progress" || status === "completed") {
    return status;
  }

  return "all";
}

function applyListingControls(
  bounties: BountyCardData[],
  { sort, status, search }: { sort: SortOption; status: StatusFilter; search: string },
) {
  const normalizedSearch = search.trim().toLowerCase();

  const filtered = bounties.filter((bounty) => {
    const matchesStatus = status === "all" ? true : (bounty.status ?? "open") === status;
    const matchesSearch =
      normalizedSearch.length === 0 ? true : bounty.title.toLowerCase().includes(normalizedSearch);

    return matchesStatus && matchesSearch;
  });

  return filtered.sort((left, right) => {
    if (sort === "highest_reward") {
      return getRewardValue(right.reward) - getRewardValue(left.reward);
    }

    if (sort === "closest_deadline") {
      return getDeadlineValue(left.deadline) - getDeadlineValue(right.deadline);
    }

    return 0;
  });
}

export default async function Home({ searchParams }: { searchParams?: SearchParams }) {
  const allBounties = await getBounties();
  const sort = normalizeSort(searchParams?.sort);
  const status = normalizeStatus(searchParams?.status);
  const search = searchParams?.search ?? "";
  const bounties = applyListingControls(allBounties, { sort, status, search });

  return (
    <main className="min-h-[calc(100vh-73px)] bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-10 flex flex-col justify-between gap-6 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-black/20 sm:p-8 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
              <LocalizedText id="home.eyebrow" />
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
              <LocalizedText id="home.title" />
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
              <LocalizedText id="home.subtitle" />
            </p>
          </div>
          <Link
            href="/bounties/new"
            className="inline-flex items-center justify-center rounded-xl bg-yellow-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-yellow-300"
          >
            <LocalizedText id="home.createBounty" />
          </Link>
        </section>

        <BountyFilters
          search={search}
          status={status}
          sort={sort}
          visibleCount={bounties.length}
          totalCount={allBounties.length}
        />

        {bounties.length > 0 ? (
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {bounties.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </section>
        ) : (
          <section className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-16 text-center">
            <p className="text-lg font-semibold text-slate-200"><LocalizedText id="home.emptyTitle" /></p>
            <p className="mt-2 text-slate-400"><LocalizedText id="home.emptyBody" /></p>
            <Link
              href="/bounties/new"
              className="mt-6 inline-flex rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-200 transition hover:border-yellow-400 hover:text-yellow-300"
            >
              <LocalizedText id="home.postBounty" />
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
