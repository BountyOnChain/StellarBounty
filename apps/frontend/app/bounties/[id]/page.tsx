import type { Metadata } from "next";
import Link from "next/link";
import { BountyDetailSkeleton, ErrorState } from "@/app/components/AsyncStates";
import BountyDetailClient from "./BountyDetailClient";
import { absoluteUrl, siteName } from "../../seo";

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
type BountyResult = { ok: true; bounty: Bounty } | { ok: false; message: string };

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

async function getBounty(id: string): Promise<BountyResult> {
  try {
    const response = await fetch(`${API_URL}/bounties/${encodeURIComponent(id)}`, { next: { revalidate: 60 } });

    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
      return { ok: false, message: "The bounty could not be loaded from the API." };
    }

    const bounty = normalizeBounty((await response.json()) as ApiBounty);
    return bounty
      ? { ok: true, bounty }
      : { ok: false, message: "The bounty response was missing required fields." };
  } catch {
    return { ok: false, message: "The bounty could not be loaded. Check the backend connection." };
  }
}

function getBountyDescription(bounty: Bounty) {
  return bounty.description.replace(/\s+/g, " ").trim().slice(0, 155) ||
    `Review the ${bounty.title} bounty on StellarBounty.`;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const result = await getBounty(params.id);

  if (!result.ok) {
    return {
      title: "Bounty Unavailable",
      description: "This StellarBounty listing could not be loaded.",
      alternates: {
        canonical: absoluteUrl(`/bounties/${params.id}`),
      },
    };
  }

  const bounty = result.bounty;
  const description = getBountyDescription(bounty);
  const url = absoluteUrl(`/bounties/${bounty.id}`);

  return {
    title: bounty.title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${bounty.title} | ${siteName}`,
      description,
      url,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `${bounty.title} | ${siteName}`,
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

    const payload = (await response.json()) as ApiBountiesResponse;
    const bounties = Array.isArray(payload) ? payload : payload.data ?? [];

    return bounties.flatMap((bounty) => (bounty.id ? [{ id: bounty.id }] : []));
  } catch {
    return [];
  }
}

export default async function BountyDetailPage({ params }: { params: { id: string } }) {
  const result = await getBounty(params.id);

  if (!result.ok) {
    return (
      <main className="min-h-[calc(100vh-73px)] bg-slate-950 px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-6xl space-y-5">
          <ErrorState
            title="Bounty unavailable"
            message={result.message}
            retry={{ href: `/bounties/${params.id}`, label: "Retry bounty" }}
          />
          <BountyDetailSkeleton />
          <div className="text-center">
            <Link href="/" className="text-sm font-medium text-yellow-300 hover:text-yellow-200">
              Back to listings
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const bounty = result.bounty;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: bounty.title,
    description: getBountyDescription(bounty),
    url: absoluteUrl(`/bounties/${bounty.id}`),
    dateModified: bounty.deadline === "No deadline" ? undefined : bounty.deadline,
    offers: {
      "@type": "Offer",
      price: bounty.reward,
      priceCurrency: "XLM",
      availability: bounty.status === "open" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <BountyDetailClient bounty={bounty} />
    </>
  );
}
