import { cache } from "react";
import type { AnalyticsSummary, Store, Trend } from "./types";
import { createServerSupabaseClient } from "./supabase-server";
import { isTrendEligibleForIndexing } from "./trend-indexing";

type TrendWithStoreCount = Trend & {
  store_count: number;
  stores?: { count: number }[] | null;
};

export interface HomePageData {
  trends: TrendWithStoreCount[];
  verifiedStoreCount: number;
  totalViewCount: number;
  lastUpdated: string | null;
}

export interface TrendDetailData {
  trend: TrendWithStoreCount;
  stores: Store[];
}

export const getActiveTrends = cache(async (): Promise<TrendWithStoreCount[]> => {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return [];
  }

  const { data } = await supabase
    .from("trends")
    .select("*, stores(count)")
    .in("status", ["rising", "active", "declining"])
    .order("peak_score", { ascending: false })
    .order("id", { ascending: true });

  return (
    data?.map((trend: any, index) => ({
      ...trend,
      store_count: trend.stores?.[0]?.count ?? 0,
      current_rank: index + 1,
    })) ?? []
  ) as TrendWithStoreCount[];
});

export const getHomePageData = cache(async (): Promise<HomePageData> => {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return {
      trends: [],
      verifiedStoreCount: 0,
      totalViewCount: 0,
      lastUpdated: null,
    };
  }

  const [trends, verifiedStoresResult, analyticsResult] = await Promise.all([
    getActiveTrends(),
    supabase
      .from("stores")
      .select("id", { count: "exact", head: true })
      .eq("verified", true),
    supabase.rpc("get_analytics_summary", { days_back: 3650 }),
  ]);
  const analytics = analyticsResult.data as Pick<
    AnalyticsSummary,
    "total_views"
  > | null;

  return {
    trends,
    verifiedStoreCount: verifiedStoresResult.count ?? 0,
    totalViewCount: analytics?.total_views ?? 0,
    lastUpdated: trends[0]?.detected_at ?? null,
  };
});

export const getTrendDetailById = cache(
  async (id: string): Promise<TrendDetailData | null> => {
    const supabase = createServerSupabaseClient();

    if (!supabase) {
      return null;
    }

    const [trendResult, storesResult, activeTrends] = await Promise.all([
      supabase.from("trends").select("*, stores(count)").eq("id", id).single(),
      supabase
        .from("stores")
        .select("*")
        .eq("trend_id", id)
        .order("verified", { ascending: false }),
      getActiveTrends(),
    ]);

    if (!trendResult.data) {
      return null;
    }

    const trend = trendResult.data as TrendWithStoreCount;
    const rankedTrend = activeTrends.find((activeTrend) => activeTrend.id === id);

    return {
      trend: {
        ...trend,
        store_count: trend.stores?.[0]?.count ?? 0,
        current_rank: rankedTrend?.current_rank ?? null,
      },
      stores: (storesResult.data as Store[]) ?? [],
    };
  }
);

export const getTrendsForSitemap = cache(
  async (): Promise<Array<Pick<Trend, "id" | "detected_at">>> => {
    const supabase = createServerSupabaseClient();

    if (!supabase) {
      return [];
    }

    const { data } = await supabase
      .from("trends")
      .select("id, detected_at, description, status, stores(count)")
      .in("status", ["rising", "active", "declining"])
      .order("detected_at", { ascending: false });

    return (
      (data ?? [])
        .map((trend: any) => ({
          id: trend.id,
          detected_at: trend.detected_at,
          description: trend.description,
          status: trend.status,
          store_count: trend.stores?.[0]?.count ?? 0,
        }))
        .filter((trend) => isTrendEligibleForIndexing(trend))
        .map(({ id, detected_at }) => ({ id, detected_at })) as Array<
        Pick<Trend, "id" | "detected_at">
      >
    );
  }
);
