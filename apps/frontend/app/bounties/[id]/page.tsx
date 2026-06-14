import type { Metadata } from "next";
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

function truncateDescription(description: string) {
  const normalized = description.replace(/\s+/g, " ").trim();
  return normalized.length > 155 ? `${normalized.slice(0, 152)}...` : normalized;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const bounty = await getBounty(params.id);

  if (!bounty) {
    return {
      title: "Bounty unavailable",
      description: "This StellarBounty task could not be loaded from the API.",
      alternates: {
        canonical: `/bounties/${params.id}`,
      },
    };
  }

  const description = truncateDescription(bounty.description);

  return {
    title: bounty.title,
    description,
    alternates: {
      canonical: `/bounties/${bounty.id}`,
    },
    openGraph: {
      title: bounty.title,
      description,
      url: `/bounties/${bounty.id}`,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: bounty.title,
      description,
    },
  };
}

export async function generateStaticParams() {
  try {
    const response = await fetch(`${API_URL}/bounties`, { next: { revalidate: 60 } });

    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
      return [];
    }

    const bounties = (await response.json()) as ApiBounty[];

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

  const bountyJsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: bounty.title,
    description: bounty.description,
    datePosted: new Date().toISOString(),
    validThrough: bounty.deadline === "No deadline" ? undefined : bounty.deadline,
    hiringOrganization: {
      "@type": "Organization",
      name: "StellarBounty",
    },
    incentiveCompensation: `${bounty.reward} XLM`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(bountyJsonLd) }}
      />
      <BountyDetailClient bounty={bounty} />
    </>
  );
}
