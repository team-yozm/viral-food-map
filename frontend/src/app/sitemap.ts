import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getTrendsForSitemap } from "@/lib/trends-server";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const trends = await getTrendsForSitemap();

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/how-it-works`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/editorial-policy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/data-sources`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date("2026-03-25"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date("2026-03-25"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...trends.map((trend) => ({
      url: `${SITE_URL}/trend/${trend.id}`,
      lastModified: trend.detected_at ? new Date(trend.detected_at) : now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
