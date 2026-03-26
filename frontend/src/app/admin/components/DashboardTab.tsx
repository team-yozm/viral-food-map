"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import TrendBadge from "@/components/TrendBadge";
import type { AnalyticsSummary } from "@/lib/types";

interface TrendSummary {
  id: string;
  name: string;
  status: string;
  detected_at: string;
  stores: { count: number }[];
}

interface RecentStore {
  id: string;
  name: string;
  created_at: string;
  trends?: { name: string } | null;
}

interface DashboardStats {
  trends: { total: number; rising: number; active: number };
  stores: { total: number; verified: number; unverified: number };
  pendingReports: number;
  keywords: { total: number; active: number };
}

function getPageDisplayName(path: string): string {
  if (path === "/") return "홈";
  if (path === "/map") return "지도";
  if (path === "/report") return "제보";
  if (path.startsWith("/trend/")) return "트렌드 상세";
  if (path === "/admin") return "어드민";
  return path;
}

export default function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [recentTrends, setRecentTrends] = useState<TrendSummary[]>([]);
  const [recentStores, setRecentStores] = useState<RecentStore[]>([]);
  const [lastDetected, setLastDetected] = useState<string | null>(null);
  const [crawlStatus, setCrawlStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [trendsRes, storesRes, storesVerifiedRes, storesUnverifiedRes, reportsRes, keywordsRes, recentRes, recentStoresRes, analyticsRes] =
        await Promise.all([
          supabase.from("trends").select("id, status"),
          supabase.from("stores").select("*", { count: "exact", head: true }),
          supabase.from("stores").select("*", { count: "exact", head: true }).eq("verified", true),
          supabase.from("stores").select("*", { count: "exact", head: true }).eq("verified", false),
          supabase.from("reports").select("id").eq("status", "pending"),
          supabase.from("keywords").select("id, is_active"),
          supabase
            .from("trends")
            .select("id, name, status, detected_at, stores(count)")
            .order("detected_at", { ascending: false })
            .limit(5),
          supabase
            .from("stores")
            .select("id, name, created_at, trends(name)")
            .order("created_at", { ascending: false })
            .limit(10),
          supabase.rpc("get_analytics_summary", { days_back: 14 }),
        ]);

      const trends = trendsRes.data || [];
      const keywords = keywordsRes.data || [];

      setStats({
        trends: {
          total: trends.length,
          rising: trends.filter((t) => t.status === "rising").length,
          active: trends.filter((t) => t.status === "active").length,
        },
        stores: {
          total: storesRes.count || 0,
          verified: storesVerifiedRes.count || 0,
          unverified: storesUnverifiedRes.count || 0,
        },
        pendingReports: reportsRes.data?.length || 0,
        keywords: {
          total: keywords.length,
          active: keywords.filter((k) => k.is_active).length,
        },
      });

      if (analyticsRes.data) {
        setAnalytics(analyticsRes.data as AnalyticsSummary);
      }

      const recentData = (recentRes.data as TrendSummary[]) || [];
      setRecentTrends(recentData);
      setRecentStores((recentStoresRes.data as unknown as RecentStore[]) || []);
      if (recentData.length > 0) {
        setLastDetected(recentData[0].detected_at);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  const triggerCrawl = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;

    setCrawlStatus("loading");
    try {
      const res = await fetch(`${apiUrl}/api/trends/detect`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      setCrawlStatus("success");
      setTimeout(() => setCrawlStatus("idle"), 3000);
    } catch {
      setCrawlStatus("error");
      setTimeout(() => setCrawlStatus("idle"), 5000);
    }
  };

  if (loading || !stats) {
    return <p className="text-center text-gray-400 py-12">로딩 중...</p>;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const dailyMax = analytics?.daily_views
    ? Math.max(...analytics.daily_views.map((d) => d.view_count), 1)
    : 1;
  const hourlyMax = analytics?.hourly_distribution
    ? Math.max(...analytics.hourly_distribution.map((h) => h.view_count), 1)
    : 1;

  return (
    <div className="flex flex-col gap-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-400 mb-1">트렌드</p>
          <p className="text-2xl font-bold text-gray-900">{stats.trends.total}</p>
          <p className="text-xs text-gray-400 mt-1">
            급상승 {stats.trends.rising} / 인기 {stats.trends.active}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-400 mb-1">판매처</p>
          <p className="text-2xl font-bold text-gray-900">{stats.stores.total}</p>
          <p className="text-xs text-gray-400 mt-1">
            인증 {stats.stores.verified} / 미인증 {stats.stores.unverified}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-400 mb-1">대기 제보</p>
          <p className={`text-2xl font-bold ${stats.pendingReports > 0 ? "text-red-500" : "text-gray-900"}`}>
            {stats.pendingReports}
          </p>
          <p className="text-xs text-gray-400 mt-1">승인 대기 중</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-400 mb-1">키워드</p>
          <p className="text-2xl font-bold text-gray-900">{stats.keywords.active}</p>
          <p className="text-xs text-gray-400 mt-1">
            활성 {stats.keywords.active} / 전체 {stats.keywords.total}
          </p>
        </div>
      </div>

      {/* 방문 통계 카드 */}
      {analytics && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">총 페이지뷰</p>
              <p className="text-2xl font-bold text-purple-600">
                {analytics.total_views.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">오늘 방문</p>
              <p className="text-2xl font-bold text-purple-600">
                {analytics.today_views.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                순 방문 {analytics.today_unique}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">순 방문자</p>
              <p className="text-2xl font-bold text-blue-500">
                {analytics.unique_visitors.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">전체 기간</p>
            </div>
          </div>

          {/* 일별 방문 추이 */}
          {analytics.daily_views && analytics.daily_views.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">일별 방문 추이 (14일)</h3>
              <div className="flex items-end gap-1 h-32">
                {analytics.daily_views.map((day) => {
                  const heightPercent = (day.view_count / dailyMax) * 100;
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-400">{day.view_count}</span>
                      <div
                        className="w-full rounded-t-sm min-h-[2px]"
                        style={{
                          height: `${heightPercent}%`,
                          backgroundColor: "#9B7DD4",
                        }}
                      />
                      <span className="text-[10px] text-gray-400">
                        {new Date(day.date).getDate()}일
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-end gap-1 h-20 mt-4">
                {analytics.daily_views.map((day) => {
                  const uniqueMax = Math.max(...analytics.daily_views!.map((d) => d.unique_count), 1);
                  const heightPercent = (day.unique_count / uniqueMax) * 100;
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-400">{day.unique_count}</span>
                      <div
                        className="w-full rounded-t-sm min-h-[2px]"
                        style={{
                          height: `${heightPercent}%`,
                          backgroundColor: "#8BACD8",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#9B7DD4" }} />
                  <span className="text-[10px] text-gray-400">페이지뷰</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#8BACD8" }} />
                  <span className="text-[10px] text-gray-400">순 방문자</span>
                </div>
              </div>
            </div>
          )}

          {/* 시간대별 방문 분포 */}
          {analytics.hourly_distribution && analytics.hourly_distribution.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">시간대별 방문 분포 (최근 7일)</h3>
              <div className="flex items-end gap-[2px] h-24">
                {Array.from({ length: 24 }, (_, hour) => {
                  const data = analytics.hourly_distribution!.find((h) => h.hour === hour);
                  const count = data?.view_count || 0;
                  const heightPercent = (count / hourlyMax) * 100;
                  return (
                    <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-sm min-h-[2px]"
                        style={{
                          height: `${heightPercent}%`,
                          backgroundColor: count > 0 ? "#9B7DD4" : "#E5E7EB",
                        }}
                      />
                      {hour % 3 === 0 && (
                        <span className="text-[9px] text-gray-400">{hour}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-1 text-right">시 (0~23)</p>
            </div>
          )}

          {/* 인기 페이지 TOP 5 */}
          {analytics.top_pages && analytics.top_pages.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 text-sm mb-3">인기 페이지 TOP 5</h3>
              <div className="flex flex-col gap-2">
                {analytics.top_pages.map((page, i) => (
                  <div
                    key={page.page_path}
                    className="bg-white rounded-xl p-3 border border-gray-100 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-purple-500 w-5">{i + 1}</span>
                      <span className="font-medium text-sm text-gray-900">
                        {getPageDisplayName(page.page_path)}
                      </span>
                      <span className="text-xs text-gray-400">{page.page_path}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                      {page.view_count.toLocaleString()}회
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 트렌드별 조회수 */}
          {analytics.trend_views && analytics.trend_views.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 text-sm mb-3">트렌드별 조회수</h3>
              <div className="flex flex-col gap-2">
                {analytics.trend_views.map((tv, i) => {
                  const maxTrendViews = analytics.trend_views![0].view_count;
                  const barPercent = (tv.view_count / maxTrendViews) * 100;
                  return (
                    <div
                      key={tv.trend_id}
                      className="bg-white rounded-xl p-3 border border-gray-100"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-purple-500 w-5">{i + 1}</span>
                          <span className="font-medium text-sm text-gray-900">{tv.trend_name}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-700">
                          {tv.view_count.toLocaleString()}회
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${barPercent}%`,
                            backgroundColor: "#9B7DD4",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* 크롤링 트리거 */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">수동 크롤링</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              트렌드 감지 + 판매처 수집을 즉시 실행합니다
            </p>
            {lastDetected && (
              <p className="text-xs text-gray-400 mt-1">
                마지막 감지: {new Date(lastDetected).toLocaleString("ko-KR")}
              </p>
            )}
          </div>
          <button
            onClick={triggerCrawl}
            disabled={!apiUrl || crawlStatus === "loading"}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
              crawlStatus === "success"
                ? "bg-green-500 text-white"
                : crawlStatus === "error"
                  ? "bg-red-500 text-white"
                  : "bg-primary text-white hover:bg-purple-600"
            }`}
          >
            {crawlStatus === "loading"
              ? "실행 중..."
              : crawlStatus === "success"
                ? "완료!"
                : crawlStatus === "error"
                  ? "실패"
                  : !apiUrl
                    ? "API URL 미설정"
                    : "크롤링 실행"}
          </button>
        </div>
      </div>

      {/* 최근 트렌드 */}
      <div>
        <h3 className="font-semibold text-gray-900 text-sm mb-3">최근 감지된 트렌드</h3>
        <div className="flex flex-col gap-2">
          {recentTrends.length === 0 ? (
            <p className="text-center text-gray-400 py-8">감지된 트렌드가 없습니다</p>
          ) : (
            recentTrends.map((t) => (
              <div
                key={t.id}
                className="bg-white rounded-xl p-3 border border-gray-100 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <TrendBadge status={t.status} />
                  <span className="font-medium text-sm text-gray-900">{t.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>판매처 {t.stores?.[0]?.count ?? 0}곳</span>
                  <span>{new Date(t.detected_at).toLocaleDateString("ko-KR")}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* 최근 수집된 판매처 */}
      <div>
        <h3 className="font-semibold text-gray-900 text-sm mb-3">최근 수집된 판매처</h3>
        <div className="flex flex-col gap-2">
          {recentStores.length === 0 ? (
            <p className="text-center text-gray-400 py-8">수집된 판매처가 없습니다</p>
          ) : (
            recentStores.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-xl p-3 border border-gray-100 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm text-gray-900">{s.name}</span>
                  <span className="text-xs text-purple-500 font-medium">
                    {s.trends?.name}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(s.created_at).toLocaleString("ko-KR")}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
