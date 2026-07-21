import type { Metadata } from "next";
import Link from "next/link";
import { type BountyCardData } from "@/app/components/BountyCard";
import BountyListClient from "@/app/components/BountyListClient";
import BountySearchInput, { type BountyStatusCounts } from "@/app/components/BountySearchInput";
import { absoluteUrl, defaultDescription, siteName } from "./seo";


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
type StatusFilter = "all" | "open" | "in_progress" | "completed" | "cancelled";

const DEFAULT_PAGE_SIZE = 20;

type SearchParams = {
  q?: string;
  sort?: string;
  status?: string;
  search?: string;
  page?: string;
  limit?: string;
};

type ApiBounty = Partial<BountyCardData> & {
  _id?: string;
  amount?: string | number | null;
  rewardAmount?: string | number | null;
  dueDate?: string | null;
};

type ApiBountiesPayload = {
  data?: ApiBounty[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  nextCursor?: string | null;
};

type ApiBountiesResponse = ApiBounty[] | ApiBountiesPayload;

type LoadedBounties = {
  bounties: BountyCardData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  nextCursor: string | null;
};

function normalizePage(value: string | undefined): number {
  const n = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function normalizeLimit(value: string | undefined): number {
  const n = Number.parseInt(value ?? `${DEFAULT_PAGE_SIZE}`, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PAGE_SIZE;
  // Cap at 100 to match the backend's MAX_PAGE_SIZE.
  return Math.min(100, n);
}

async function getBounties(
  page: number,
  limit: number,
): Promise<LoadedBounties> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  try {
    const url = new URL(`${apiUrl}/api/v1/bounties`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(limit));
    const response = await fetch(url, { next: { revalidate } });

    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
      return { bounties: [], total: 0, page, pageSize: limit, totalPages: 1, nextCursor: null };
    }

    const payload = (await response.json()) as ApiBountiesResponse;
    const data = Array.isArray(payload) ? payload : payload.data ?? [];
    const total = Array.isArray(payload) ? data.length : payload.total ?? data.length;
    const respPage = Array.isArray(payload) ? 1 : payload.page ?? page;
    const respPageSize = Array.isArray(payload) ? data.length : payload.pageSize ?? limit;
    const totalPages = Array.isArray(payload)
      ? 1
      : payload.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, respPageSize)));
    const nextCursor = Array.isArray(payload) ? null : payload.nextCursor ?? null;

    const bounties = data.map((bounty, index) => ({
      id: bounty.id ?? bounty._id ?? index,
      title: bounty.title ?? "Untitled bounty",
      reward: bounty.reward ?? bounty.rewardAmount ?? bounty.amount ?? null,
      deadline: bounty.deadline ?? bounty.dueDate ?? null,
      status: bounty.status ?? "open",
    }));

    return { bounties, total, page: respPage, pageSize: respPageSize, totalPages, nextCursor };
  } catch {
    return { bounties: [], total: 0, page, pageSize: limit, totalPages: 1, nextCursor: null };
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
  if (status === "open" || status === "in_progress" || status === "completed" || status === "cancelled") {
    return status;
  }

  return "all";
}

function getStatusCounts(bounties: BountyCardData[], search: string): BountyStatusCounts {
  const normalizedSearch = search.trim().toLowerCase();
  const counts: BountyStatusCounts = { open: 0, in_progress: 0, completed: 0, cancelled: 0 };

  for (const bounty of bounties) {
    if (normalizedSearch && !bounty.title.toLowerCase().includes(normalizedSearch)) continue;
    const status = bounty.status ?? "open";
    if (status in counts) counts[status as keyof BountyStatusCounts] += 1;
  }

  return counts;
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
  const page = normalizePage(searchParams?.page);
  const pageSize = normalizeLimit(searchParams?.limit);
  const { bounties: pageBounties, total, nextCursor } = await getBounties(page, pageSize);
  const sort = normalizeSort(searchParams?.sort);
  const status = normalizeStatus(searchParams?.status);
  const search = searchParams?.q ?? searchParams?.search ?? "";
  const statusCounts = getStatusCounts(pageBounties, search);
  const bounties = applyListingControls(pageBounties, { sort, status, search });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const filters: Record<string, string> = {};
  if (status !== "all") filters.status = status;

  return (
    <main className="min-h-[calc(100vh-73px)] bg-slate-50 px-4 py-10 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-10 flex flex-col justify-between gap-6 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-2xl shadow-slate-200/70 transition-colors dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 dark:shadow-black/20 sm:p-8 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-600 dark:text-yellow-400">StellarBounty</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              Open bounties ready for builders
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400">
              Browse funded work, compare rewards and deadlines, then jump into a task that matches your skills.
            </p>
          </div>
          <Link
            href="/bounties/new"
            className="inline-flex items-center justify-center rounded-xl bg-yellow-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-yellow-300"
          >
            Create Bounty
          </Link>
        </section>

        <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60 transition-colors dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-black/10 sm:p-6">
          <form className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)_auto] md:items-end">
            <BountySearchInput initialSearch={search} statusCounts={statusCounts} />

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
              <select
                name="status"
                defaultValue={status}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-yellow-400"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Sort by</span>
              <select
                name="sort"
                defaultValue={sort}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-yellow-400"
              >
                <option value="newest">Newest</option>
                <option value="highest_reward">Highest reward</option>
                <option value="closest_deadline">Closest deadline</option>
              </select>
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="inline-flex min-w-28 items-center justify-center rounded-2xl bg-yellow-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-yellow-300"
              >
                Apply
              </button>
              <Link
                href="/"
                className="inline-flex min-w-28 items-center justify-center rounded-2xl border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:border-slate-500 hover:text-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
              >
                Reset
              </Link>
            </div>
          </form>

          <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing <span className="font-semibold text-slate-900 dark:text-slate-200">{bounties.length}</span> of{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-200">{total}</span> bounties
            </p>
            <p className="text-slate-500 dark:text-slate-500">Scroll down to load more bounties automatically.</p>
          </div>
        </section>

        <BountyListClient
          initialData={bounties}
          initialTotal={total}
          initialNextCursor={nextCursor}
          baseUrl={apiUrl}
          filters={filters}
        />
      </div>
    </main>
  );
}
