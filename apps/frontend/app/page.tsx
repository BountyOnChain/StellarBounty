import Link from "next/link";
import BountyCard, { type BountyCardData } from "@/app/components/BountyCard";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export const revalidate = 60;

type ApiBounty = Partial<BountyCardData> & {
  _id?: string;
  amount?: string | number | null;
  rewardAmount?: string | number | null;
  dueDate?: string | null;
};

async function getBounties(): Promise<BountyCardData[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  try {
    const response = await fetch(`${apiUrl}/bounties`, { next: { revalidate } });

    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
      return [];
    }

    const bounties = (await response.json()) as ApiBounty[];

    return bounties.map((bounty, index) => ({
      id: bounty.id ?? bounty._id ?? index,
      title: bounty.title ?? "Untitled bounty",
      reward: bounty.reward ?? bounty.rewardAmount ?? bounty.amount ?? null,
      deadline: bounty.deadline ?? bounty.dueDate ?? null,
      status: bounty.status ?? "open",
    }));
  } catch {
    return [];
  }
}

export default async function Home() {
  const [bounties, setBounties] = useState<BountyCardData[]>([]);
  const [sort, setSort] = useState("newest");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchBounties = async () => {
      const data = await getBounties();
      setBounties(data);
    };
    fetchBounties();
  }, []);

  useEffect(() => {
    const query = {};
    if (sort !== "newest") query.sort = sort;
    if (filter !== "all") query.filter = filter;
    if (search) query.search = search;
    router.push(
      {
        pathname: "/",
        query,
      },
      undefined,
      { shallow: true }
    );
  }, [sort, filter, search]);

  useEffect(() => {
    const query = router.query;
    if (query.sort) setSort(query.sort as string);
    if (query.filter) setFilter(query.filter as string);
    if (query.search) setSearch(query.search as string);
  }, [router.query]);

  const sortedBounties = () => {
    switch (sort) {
      case "newest":
        return bounties.sort((a, b) => b.id - a.id);
      case "highest":
        return bounties.sort((a, b) => (b.reward ?? 0) - (a.reward ?? 0));
      case "closest":
        return bounties.sort((a, b) => new Date(a.deadline ?? "").getTime() - new Date(b.deadline ?? "").getTime());
      default:
        return bounties;
    }
  };

  const filteredBounties = sortedBounties().filter((bounty) => {
    if (filter === "all") return true;
    if (filter === "open" && bounty.status === "open") return true;
    if (filter === "in-progress" && bounty.status === "in-progress") return true;
    if (filter === "completed" && bounty.status === "completed") return true;
    return false;
  });

  const searchedBounties = filteredBounties.filter((bounty) => bounty.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="min-h-[calc(100vh-73px)] bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-10 flex flex-col justify-between gap-6 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 shadow-2xl shadow-black/20 sm:p-8 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">StellarBounty</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
              Open bounties ready for builders
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
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

        <section className="flex flex-col gap-4 md:flex-row md:justify-between">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl bg-slate-900 p-2 text-slate-200"
          >
            <option value="newest">Newest</option>
            <option value="highest">Highest Reward</option>
            <option value="closest">Closest Deadline</option>
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-xl bg-slate-900 p-2 text-slate-200"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title"
            className="rounded-xl bg-slate-900 p-2 text-slate-200"
          />
        </section>

        {searchedBounties.length > 0 ? (
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {searchedBounties.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </section>
        ) : (
          <section className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-16 text-center">
            <p className="text-lg font-semibold text-slate-200">No bounties available yet.</p>
            <p className="mt-2 text-slate-400">Create the first bounty and bring new work onto Stellar.</p>
            <Link
              href="/bounties/new"
              className="mt-6 inline-flex rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-200 transition hover:border-yellow-400 hover:text-yellow-300"
            >
              Post a bounty
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}