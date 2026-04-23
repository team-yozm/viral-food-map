"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import AdSlot from "@/components/AdSlot";
import BottomNav from "@/components/BottomNav";
import KakaoMap from "@/components/KakaoMap";
import ScrollToTop from "@/components/ScrollToTop";
import { ADSENSE_TREND_DETAIL_SLOT } from "@/lib/adsense";
import useAppClipExperience from "@/hooks/useAppClipExperience";
import { isNative } from "@/lib/capacitor-utils";
import { stripAppClipParam, withAppClipParam } from "@/lib/app-clip";
import { getCurrentPosition } from "@/lib/native-geolocation";
import { formatTrendDetectedDate } from "@/lib/trend-indexing";
import type { Store, Trend } from "@/lib/types";

interface TrendDetailPageClientProps {
  id: string;
  initialTrend: Trend | null;
  initialStores: Store[];
}

type UserLocation = {
  lat: number;
  lng: number;
};

function getDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return km >= 100 ? `${Math.round(km)}km` : `${km.toFixed(1)}km`;
}

const STATUS_LABEL: Record<string, string> = {
  rising: "상승 중",
  active: "활성",
  declining: "하락 중",
  watchlist: "관찰 중",
  inactive: "비활성",
};

const STATUS_KICKER: Record<string, string> = {
  rising: "RISING",
  active: "ACTIVE",
  declining: "COOLING",
  watchlist: "WATCH",
  inactive: "PAUSED",
};

function SectionLabel({
  kicker,
  title,
  action,
  onAction,
  className = "",
}: {
  kicker?: string;
  title: string;
  action?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div className={`px-5 pb-3 pt-7 ${className}`}>
      <div className="flex items-baseline justify-between">
        <div>
          {kicker ? (
            <div className="font-kicker mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
              {kicker}
            </div>
          ) : null}
          <div className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">
            {title}
          </div>
        </div>
        {action ? (
          <button
            type="button"
            onClick={onAction}
            className="flex items-center gap-1 text-xs font-semibold text-ink3 hover:text-ink"
          >
            {action}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StoreTypeBadge({ isFranchise }: { isFranchise: boolean }) {
  return isFranchise ? (
    <span className="shrink-0 rounded bg-line2 px-1.5 py-0.5 text-[9.5px] font-bold leading-none text-ink3">
      프랜차이즈
    </span>
  ) : (
    <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-bold leading-none text-accent-ink">
      개인
    </span>
  );
}

export default function TrendDetailPageClient({
  id,
  initialTrend,
  initialStores,
}: TrendDetailPageClientProps) {
  const router = useRouter();
  const isAppClipExperience = useAppClipExperience();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [storeQuery, setStoreQuery] = useState("");
  const [userLoc, setUserLoc] = useState<UserLocation | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [canRetryLocation, setCanRetryLocation] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const requestLocation = useCallback(
    () =>
      getCurrentPosition({ timeout: 5000 })
        .then((nextLocation) => {
          setUserLoc(nextLocation);
          setLocationMessage(null);
          setCanRetryLocation(false);
          return nextLocation as UserLocation | null;
        })
        .catch((error) => {
          setUserLoc(null);

          const nextMessage =
            error?.message === "GEOLOCATION_NOT_SUPPORTED"
              ? "위치 기능을 지원하지 않아 가까운 판매처 기준 정렬은 제공하지 못하고 있습니다."
              : "브라우저 위치 권한이 없어 가까운 판매처 기준 정렬을 제공하지 못하고 있습니다.";

          setLocationMessage(nextMessage);
          setCanRetryLocation(error?.message !== "GEOLOCATION_NOT_SUPPORTED");
          return null as UserLocation | null;
        }),
    []
  );

  useEffect(() => {
    void requestLocation();
  }, [requestLocation]);

  const sortedStores = useMemo(() => {
    const stores = userLoc
      ? [...initialStores].sort(
          (a, b) =>
            getDistance(userLoc.lat, userLoc.lng, a.lat, a.lng) -
            getDistance(userLoc.lat, userLoc.lng, b.lat, b.lng)
        )
      : initialStores;

    if (!storeQuery.trim()) {
      return stores;
    }

    const query = storeQuery.trim().toLowerCase();
    return stores.filter(
      (store) =>
        store.name.toLowerCase().includes(query) ||
        store.address.toLowerCase().includes(query)
    );
  }, [initialStores, storeQuery, userLoc]);

  const nearestStore = sortedStores[0];
  const mapCenter = nearestStore
    ? { lat: nearestStore.lat, lng: nearestStore.lng }
    : { lat: 37.5665, lng: 126.978 };

  const previewStores = useMemo(() => sortedStores.slice(0, 4), [sortedStores]);
  const detectedLabel = formatTrendDetectedDate(initialTrend?.detected_at);

  const momentumChart = useMemo(() => {
    const data = initialTrend?.search_volume_data;
    if (!data) return null;
    const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
    if (!entries.length) return null;
    const recent = entries.slice(-8);
    const max = Math.max(...recent.map(([, v]) => v), 1);
    return {
      bars: recent.map(([date, value], index) => ({
        date,
        value,
        percent: Math.max((value / max) * 100, 6),
        label: `W${index + 1}`,
      })),
      delta:
        recent.length >= 2 && recent[0][1] > 0
          ? Math.round(
              ((recent[recent.length - 1][1] - recent[0][1]) / recent[0][1]) *
                100
            )
          : null,
    };
  }, [initialTrend?.search_volume_data]);

  const handleShare = useCallback(async () => {
    if (!initialTrend) return;
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    const currentUrl =
      typeof window !== "undefined" ? window.location.href : "";
    const shareUrl = stripAppClipParam(currentUrl);
    const title = `${initialTrend.name} - 요즘뭐먹`;
    const description = initialTrend.description ?? undefined;

    if (isNative()) {
      try {
        const { Share } = await import("@capacitor/share");
        await Share.share({
          title,
          text: description ?? "요즘뭐먹에서 확인해보세요!",
          url: shareUrl,
          dialogTitle: "공유하기",
        });
        return;
      } catch {
        // fall through to clipboard
      }
    }

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const el = document.createElement("input");
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 2000);
  }, [initialTrend]);

  const handleBack = useCallback(() => {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    router.back();
  }, [router]);

  if (!initialTrend) {
    return (
      <>
        <main className="page-with-bottom-nav mx-auto max-w-lg px-4 py-12 text-center text-ink4">
          <p className="mb-3 text-4xl">😕</p>
          <p>트렌드를 찾을 수 없어요.</p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-6 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-surface"
          >
            돌아가기
          </button>
        </main>
        <BottomNav />
      </>
    );
  }

  const imageUrl = initialTrend.image_url;
  const statusKicker =
    STATUS_KICKER[initialTrend.status] ?? initialTrend.status.toUpperCase();
  const currentRank = initialTrend.current_rank;

  return (
    <>
      <main className="page-with-bottom-nav mx-auto max-w-lg bg-bg pb-8">
        {/* Hero image header */}
        <div
          className="relative h-[280px] overflow-hidden bg-hero-top"
          style={{
            backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 100%)",
            }}
          />
          <button
            type="button"
            onClick={handleBack}
            aria-label="뒤로 가기"
            className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink backdrop-blur transition-transform active:scale-95"
            style={{ top: "calc(14px + var(--safe-top))" }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="공유하기"
            className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink backdrop-blur transition-transform active:scale-95"
            style={{ top: "calc(14px + var(--safe-top))" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M8.59 13.51l6.83 3.98" />
              <path d="M15.41 6.51l-6.82 3.98" />
            </svg>
          </button>
          {linkCopied ? (
            <div
              className="absolute right-4 rounded-full bg-ink/90 px-3 py-1 text-[10px] font-semibold text-surface"
              style={{ top: "calc(60px + var(--safe-top))" }}
            >
              링크 복사됨
            </div>
          ) : null}

          <div className="absolute inset-x-0 bottom-[18px] px-5 text-white">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {currentRank != null ? (
                <span className="font-kicker rounded-full bg-white px-2 py-[3px] text-[10px] font-extrabold text-ink">
                  #{currentRank}
                </span>
              ) : null}
              <span className="font-kicker rounded-full bg-white/25 px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.12em] backdrop-blur">
                {statusKicker}
              </span>
            </div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em]">
              {initialTrend.name}
            </h1>
            <div className="mt-1 text-xs opacity-85">
              {initialTrend.category}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="relative z-[2] -mt-4 mx-4 grid grid-cols-3 gap-3 rounded-[20px] border border-line bg-surface p-4">
          {[
            {
              l: "인기도",
              v: `${initialTrend.peak_score}`,
              s: "/100",
            },
            {
              l: "판매처",
              v: `${sortedStores.length}`,
              s: "곳",
            },
            {
              l: "감지일",
              v: detectedLabel,
              s: "",
            },
          ].map((stat) => (
            <div key={stat.l} className="text-center">
              <div className="font-kicker text-[10px] font-bold uppercase tracking-[0.12em] text-ink4">
                {stat.l}
              </div>
              <div className="mt-1.5 text-[20px] font-extrabold tracking-[-0.03em] text-ink tabular-nums">
                {stat.v}
                {stat.s ? (
                  <span className="ml-0.5 text-[11px] font-semibold text-ink4">
                    {stat.s}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Description */}
        {initialTrend.description ? (
          <div className="px-5 pt-6">
            <p className="text-[15px] leading-relaxed tracking-[-0.01em] text-ink2">
              {initialTrend.description}
            </p>
          </div>
        ) : null}

        {/* Momentum chart */}
        {momentumChart ? (
          <>
            <SectionLabel kicker="Momentum" title="검색 관심도" />
            <div className="mx-4 rounded-[20px] border border-line bg-surface p-5">
              <div className="flex h-[86px] items-end gap-2">
                {momentumChart.bars.map((bar, index) => {
                  const isLast = index === momentumChart.bars.length - 1;
                  return (
                    <div key={bar.date} className="flex h-full flex-1 flex-col justify-end">
                      <div
                        className={`w-full rounded ${
                          isLast ? "bg-accent" : "bg-line"
                        }`}
                        style={{ height: `${bar.percent}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2">
                {momentumChart.bars.map((bar) => (
                  <div
                    key={`label-${bar.date}`}
                    className="font-kicker flex-1 text-center text-[9px] text-ink4"
                  >
                    {bar.label}
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-[10px] bg-bg px-3 py-3 text-xs leading-5 text-ink3">
                {momentumChart.delta !== null ? (
                  <>
                    최근 {momentumChart.bars.length}주간 검색량이{" "}
                    <b className="text-ink">
                      {momentumChart.delta >= 0 ? "+" : ""}
                      {momentumChart.delta}%
                    </b>{" "}
                    변화했어요.
                  </>
                ) : (
                  <>최근 {momentumChart.bars.length}주 검색량 흐름이에요.</>
                )}
              </div>
            </div>
          </>
        ) : null}

        {/* Map */}
        <SectionLabel kicker="Map" title="판매처 지도" />
        <div className="mx-4 overflow-hidden rounded-[20px] border border-line">
          <KakaoMap
            stores={sortedStores}
            center={mapCenter}
            currentLocation={userLoc}
            level={5}
            autoFitBounds={false}
            selectedStoreId={selectedStoreId}
            onMarkerClick={setSelectedStoreId}
            onRequestCurrentLocation={requestLocation}
            trendLabels={{ [initialTrend.id]: initialTrend.name }}
          />
        </div>

        {locationMessage ? (
          <div className="mx-4 mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900">
              {locationMessage}
            </p>
            {canRetryLocation ? (
              <button
                type="button"
                onClick={() => {
                  void requestLocation();
                }}
                className="mt-3 rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white"
              >
                현재 위치 다시 시도
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Stores list preview */}
        {previewStores.length > 0 ? (
          <>
            <SectionLabel kicker="Stores" title="가까운 판매처" />
            <div className="mx-4 overflow-hidden rounded-[20px] border border-line bg-surface">
              {previewStores.map((store, index) => {
                const distanceKm = userLoc
                  ? getDistance(userLoc.lat, userLoc.lng, store.lat, store.lng)
                  : null;
                const isLast = index === previewStores.length - 1;
                return (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => setSelectedStoreId(store.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                      selectedStoreId === store.id
                        ? "bg-accent-soft"
                        : "hover:bg-bg"
                    } ${isLast ? "" : "border-b border-line2"}`}
                  >
                    <div className="font-kicker w-12 shrink-0 text-xs font-bold text-accent tabular-nums">
                      {distanceKm !== null ? formatDistance(distanceKm) : "—"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-bold tracking-[-0.01em] text-ink">
                          {store.name}
                        </span>
                        <StoreTypeBadge isFranchise={store.is_franchise} />
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-ink4">
                        {store.address}
                      </div>
                    </div>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 text-ink4"
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {/* Full store list with search (only if many stores) */}
        {initialStores.length > 4 ? (
          <>
            <SectionLabel title="모든 판매처" />
            <div className="px-4">
              <input
                type="text"
                value={storeQuery}
                onChange={(event) => setStoreQuery(event.target.value)}
                placeholder="판매처 이름이나 주소 검색"
                className="w-full rounded-[14px] border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink4 focus:border-accent focus:outline-none"
              />
              <div className="mt-3 overflow-hidden rounded-[20px] border border-line bg-surface">
                {sortedStores.map((store, index) => {
                  const distanceKm = userLoc
                    ? getDistance(
                        userLoc.lat,
                        userLoc.lng,
                        store.lat,
                        store.lng
                      )
                    : null;
                  const isLast = index === sortedStores.length - 1;
                  return (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => setSelectedStoreId(store.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${
                        selectedStoreId === store.id
                          ? "bg-accent-soft"
                          : "hover:bg-bg"
                      } ${isLast ? "" : "border-b border-line2"}`}
                    >
                      <div className="font-kicker w-12 shrink-0 text-xs font-bold text-accent tabular-nums">
                        {distanceKm !== null
                          ? formatDistance(distanceKm)
                          : "—"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-sm font-bold tracking-[-0.01em] text-ink">
                            {store.name}
                          </span>
                          <StoreTypeBadge isFranchise={store.is_franchise} />
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-ink4">
                          {store.address}
                        </div>
                      </div>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 text-ink4"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </button>
                  );
                })}
                {sortedStores.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-ink4">
                    검색 결과가 없어요.
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        {/* Contribute CTA */}
        <div className="px-4 pt-6">
          <Link
            href={withAppClipParam(
              `/report?trend=${id}`,
              isAppClipExperience
            )}
            className="flex w-full items-center gap-3.5 rounded-[20px] border border-dashed border-line bg-surface p-4 transition-colors hover:border-accent"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-kicker text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
                Contribute
              </div>
              <div className="mt-0.5 text-sm font-bold tracking-[-0.01em] text-ink">
                이 트렌드 파는 곳, 아세요?
              </div>
              <div className="mt-0.5 text-[11.5px] text-ink4">
                제보해주시면 검수 후 지도에 반영해드려요
              </div>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-ink4"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        </div>

        <div className="mt-6 px-4">
          <AdSlot slot={ADSENSE_TREND_DETAIL_SLOT} />
        </div>
      </main>
      <BottomNav />
      <ScrollToTop />
    </>
  );
}
