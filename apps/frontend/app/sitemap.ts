import type { MetadataRoute } from "next";
import { absoluteUrl, siteUrl } from "./seo";

type ApiBounty = {
  id?: string;
  updatedAt?: string | null;
};

type ApiBountiesResponse = ApiBounty[] | { data?: ApiBounty[] };

const staticRoutes = ["/", "/bounties/new", "/bounties/demo", "/dashboard"];

async function getBountyRoutes(): Promise<MetadataRoute.Sitemap> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  try {
    const response = await fetch(`${apiUrl}/api/v1/bounties`, { next: { revalidate: 300 } });

    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
      return [];
    }

    const payload = (await response.json()) as ApiBountiesResponse;
    const bounties = Array.isArray(payload) ? payload : payload.data ?? [];

    return bounties.flatMap((bounty) => {
      if (!bounty.id) return [];

      return [
        {
          url: absoluteUrl(`/bounties/${bounty.id}`),
          lastModified: bounty.updatedAt ? new Date(bounty.updatedAt) : new Date(),
          changeFrequency: "daily" as const,
          priority: 0.8,
        },
      ];
    });
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const routes = staticRoutes.map((route) => ({
    url: new URL(route, siteUrl).toString(),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: route === "/" ? 1 : 0.7,
  }));

  return [...routes, ...(await getBountyRoutes())];
}
