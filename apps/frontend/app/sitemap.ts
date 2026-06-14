import type { MetadataRoute } from "next";

type ApiBounty = {
  id?: string;
  updatedAt?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const SITE_URL = "https://stellarbounty.app";

async function getBountyRoutes() {
  try {
    const response = await fetch(`${API_URL}/bounties`, { next: { revalidate: 300 } });

    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
      return [];
    }

    const bounties = (await response.json()) as ApiBounty[];

    return bounties.flatMap((bounty) =>
      bounty.id
        ? [
            {
              url: `${SITE_URL}/bounties/${bounty.id}`,
              lastModified: bounty.updatedAt ? new Date(bounty.updatedAt) : new Date(),
              changeFrequency: "daily" as const,
              priority: 0.7,
            },
          ]
        : [],
    );
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/bounties/new`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/bounties/demo`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  return [...staticRoutes, ...(await getBountyRoutes())];
}
