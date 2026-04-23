"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";

import BottomNav from "@/components/BottomNav";
import AdSlot from "@/components/AdSlot";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import RankDeltaBadge from "@/components/RankDeltaBadge";
import ScrollToTop from "@/components/ScrollToTop";
import TrendCard from "@/components/TrendCard";
import { ADSENSE_HOME_SLOT } from "@/lib/adsense";
import { getCurrentPosition } from "@/lib/native-geolocation";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import {
  fetchYomechuSpin,
  formatDistanceMeters,
  sendYomechuFeedback,
} from "@/lib/crawler";
import { openExternalUrl } from "@/lib/external-links";
import { shouldUseUnoptimizedImage } from "@/lib/image-optimization";
import { getAddressLabelFromCoords } from "@/lib/kakao-loader";
import { DEFAULT_MAP_CENTER, hasUsableCoordinates } from "@/lib/location";
import { SITE_URL } from "@/lib/site";
import { supabase } from "@/lib/supabase";
import useAppClipExperience from "@/hooks/useAppClipExperience";
import { withAppClipParam } from "@/lib/app-clip";
import type {
  LocationStatus,
  NearbyTrendStore,
  Trend,
  YomechuCategorySlug,
  YomechuLocationPreset,
  YomechuPlace,
  YomechuResultCount,
  YomechuSpinResponse,
} from "@/lib/types";

const InstallPrompt = dynamic(() => import("@/components/InstallPrompt"), {
  ssr: false,
});
const PushSubscribeButton = dynamic(
  () => import("@/components/PushSubscribeButton"),
  { ssr: false }
);
const YomechuLauncher = dynamic(() => import("@/components/YomechuLauncher"));
const YomechuLocationPickerModal = dynamic(
  () => import("@/components/YomechuLocationPickerModal")
);
const YomechuRevealModal = dynamic(
  () => import("@/components/YomechuRevealModal")
);

interface YomechuBaseLocation {
  lat: number;
  lng: number;
  label: string;
  source: "device" | "preset" | "manual";
}

interface GroupedNearbyStore extends NearbyTrendStore {
  trend_names: string[];
}

interface HomePageClientProps {
  initialTrends: Trend[];
  verifiedStoreCount: number;
  lastUpdated: string | null;
}

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}`;
}

function getVisibleTrendNames(trendNames: string[]) {
  return trendNames.slice(0, 2);
}

function buildYomechuShareUrl(spinId: string) {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : SITE_URL;
  return new URL(`/yomechu/share/${spinId}`, baseUrl).toString();
}

function groupNearbyStores(stores: NearbyTrendStore[]) {
  const grouped = new Map<string, GroupedNearbyStore>();

  for (const store of stores) {
    const key = store.place_url || `${store.name}::${store.address}`;
    const nextTrendNames = store.trend_name ? [store.trend_name] : [];
    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, {
        ...store,
        trend_names: nextTrendNames,
      });
      continue;
    }

    grouped.set(key, {
      ...current,
      distance_km: Math.min(current.distance_km, store.distance_km),
      trend_names: Array.from(
        new Set([...current.trend_names, ...nextTrendNames])
      ),
    });
  }

  return Array.from(grouped.values())
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, 5);
}

export default function HomePageClient({
  initialTrends,
  verifiedStoreCount,
  lastUpdated,
}: HomePageClientProps) {
  const isAppClipExperience = useAppClipExperience();
  const [trends, setTrends] = useState<Trend[]>(initialTrends);
  const [nearbyStores, setNearbyStores] = useState<GroupedNearbyStore[]>([]);
  const [loading, setLoading] = useState(initialTrends.length === 0);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [yomechuBaseLocation, setYomechuBaseLocation] =
    useState<YomechuBaseLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [sessionId, setSessionId] = useState("");
  const [selectedRadius, setSelectedRadius] = useState(1000);
  const [selectedCategory, setSelectedCategory] =
    useState<YomechuCategorySlug>("all");
  const [selectedCount, setSelectedCount] = useState<YomechuResultCount>(3);
  const [yomechuLoading, setYomechuLoading] = useState(false);
  const [yomechuError, setYomechuError] = useState<string | null>(null);
  const [yomechuResult, setYomechuResult] = useState<YomechuSpinResponse | null>(
    null
  );
  const [revealOpen, setRevealOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  useEffect(() => {
    if (launcherOpen) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [launcherOpen]);

  useEffect(() => {
    const win = window as unknown as { __yozmOpenYomechu?: () => void };
    win.__yozmOpenYomechu = () => setLauncherOpen(true);
    return () => {
      if (win.__yozmOpenYomechu) {
        delete win.__yozmOpenYomechu;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextParams = new URLSearchParams(window.location.search);
    if (nextParams.get("openYomechu") !== "1") {
      return;
    }

    setLauncherOpen(true);
    nextParams.delete("openYomechu");
    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery
      ? `${window.location.pathname}?${nextQuery}`
      : window.location.pathname;

    window.history.replaceState({}, "", nextUrl);
  }, []);

  const updateBaseLocationLabel = useCallback(
    (
      source: YomechuBaseLocation["source"],
      coords: { lat: number; lng: number },
      fallbackLabel: string
    ) => {
      void getAddressLabelFromCoords(coords.lat, coords.lng)
        .then((address) => {
          const nextLabel = address ?? fallbackLabel;

          setYomechuBaseLocation((current) => {
            if (
              !current ||
              current.source !== source ||
              current.lat !== coords.lat ||
              current.lng !== coords.lng
            ) {
              return current;
            }

            if (current.label === nextLabel) {
              return current;
            }

            return {
              ...current,
              label: nextLabel,
            };
          });
        })
        .catch(() => {
          setYomechuBaseLocation((current) => {
            if (
              !current ||
              current.source !== source ||
              current.lat !== coords.lat ||
              current.lng !== coords.lng
            ) {
              return current;
            }

            if (current.label === fallbackLabel) {
              return current;
            }

            return {
              ...current,
              label: fallbackLabel,
            };
          });
        });
    },
    []
  );

  const requestUserLocation = useCallback(() => {
    setLocationStatus("loading");

    getCurrentPosition({ timeout: 5000 })
      .then((nextLocation) => {
        if (!hasUsableCoordinates(nextLocation)) {
          throw new Error("INVALID_POSITION");
        }

        setUserLoc(nextLocation);
        setYomechuBaseLocation({
          ...nextLocation,
          label: "현재 위치",
          source: "device",
        });
        setLocationStatus("granted");
      })
      .catch((error) => {
        setUserLoc(null);
        setYomechuBaseLocation((current) =>
          current && current.source !== "device" ? current : null
        );

        if (!(error instanceof Error)) {
          setLocationStatus("invalid");
          return;
        }

        switch (error.message) {
          case "PERMISSION_DENIED":
            setLocationStatus("denied");
            break;
          case "GEOLOCATION_NOT_SUPPORTED":
            setLocationStatus("unsupported");
            break;
          case "INVALID_POSITION":
          case "POSITION_UNAVAILABLE":
          case "TIMEOUT":
            setLocationStatus("invalid");
            break;
          default:
            setLocationStatus("invalid");
            break;
        }
      });
  }, []);

  const handleUsePresetLocation = useCallback((preset: YomechuLocationPreset) => {
    setYomechuBaseLocation({
      lat: preset.lat,
      lng: preset.lng,
      label: preset.label,
      source: "preset",
    });
    setYomechuError(null);
    updateBaseLocationLabel(
      "preset",
      { lat: preset.lat, lng: preset.lng },
      preset.label
    );
  }, [updateBaseLocationLabel]);

  const handleConfirmManualLocation = useCallback(
    (selection: { lat: number; lng: number; label: string }) => {
      setYomechuBaseLocation({
        lat: selection.lat,
        lng: selection.lng,
        label: selection.label,
        source: "manual",
      });
      setYomechuError(null);
      setLocationPickerOpen(false);
    },
    []
  );

  useEffect(() => {
    if (
      !launcherOpen ||
      yomechuBaseLocation?.source !== "device" ||
      yomechuBaseLocation.label !== "현재 위치"
    ) {
      return;
    }

    updateBaseLocationLabel(
      "device",
      { lat: yomechuBaseLocation.lat, lng: yomechuBaseLocation.lng },
      "현재 위치"
    );
  }, [launcherOpen, updateBaseLocationLabel, yomechuBaseLocation]);

  const fetchTrends = useCallback(async () => {
    const { data, error } = await supabase
      .from("trends")
      .select("*, stores(count)")
      .in("status", ["rising", "active", "declining"])
      .order("peak_score", { ascending: false })
      .order("id", { ascending: true });

    if (error || !data) {
      // 에러 시 기존 데이터 유지, 빈 화면 방지
      setLoading(false);
      return;
    }

    if (data.length > 0) {
      const mapped = data.map(
        (trend: Trend & { stores?: { count: number }[] | null }) => ({
          ...trend,
          store_count: trend.stores?.[0]?.count || 0,
        })
      );
      setTrends(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const storedSessionId = window.localStorage.getItem("yomechu-session-id");
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      const nextSessionId = createSessionId();
      window.localStorage.setItem("yomechu-session-id", nextSessionId);
      setSessionId(nextSessionId);
    }

    requestUserLocation();
    if (initialTrends.length === 0) {
      void fetchTrends();
    }

    const channel = supabase
      .channel("trends-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trends" },
        () => fetchTrends()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTrends, initialTrends.length, requestUserLocation]);

  useEffect(() => {
    if (!hasUsableCoordinates(userLoc)) {
      setNearbyStores([]);
      return;
    }

    const activeTrendIds = new Set(trends.map((trend) => trend.id));
    if (activeTrendIds.size === 0) {
      setNearbyStores([]);
      return;
    }

    const fetchNearby = async () => {
      const { data } = await supabase.rpc("get_nearby_trend_stores", {
        user_lat: userLoc.lat,
        user_lng: userLoc.lng,
        result_limit: 20,
      });

      const filteredStores = ((data as NearbyTrendStore[]) ?? []).filter((store) =>
        activeTrendIds.has(store.trend_id)
      );

      setNearbyStores(groupNearbyStores(filteredStores));
    };

    fetchNearby();
  }, [trends, userLoc]);

  const storeCountLabel = String(verifiedStoreCount).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ","
  );

  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string | null>(null);

  useEffect(() => {
    if (lastUpdated) {
      setLastUpdatedLabel(
        new Date(lastUpdated).toLocaleString("ko-KR", {
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      );
    }
  }, [lastUpdated]);

  const showLocationNotice =
    locationStatus === "denied" ||
    locationStatus === "invalid" ||
    locationStatus === "unsupported";
  const locationPickerInitialCenter = hasUsableCoordinates(yomechuBaseLocation)
    ? yomechuBaseLocation
    : hasUsableCoordinates(userLoc)
      ? userLoc
      : DEFAULT_MAP_CENTER;
  const locationNoticeTitle =
    locationStatus === "invalid"
      ? "현재 위치가 정확하지 않아 주변 판매처를 표시하지 않았습니다."
      : locationStatus === "unsupported"
        ? "이 브라우저에서는 위치 정보를 읽을 수 없습니다."
        : "위치 권한이 없어 주변 판매처를 아직 보여드리지 못하고 있습니다.";
  const locationNoticeDescription =
    locationStatus === "invalid"
      ? "잘못된 좌표가 감지되어 현재 위치 사용을 중단했습니다. 현재 위치를 다시 확인하거나 기준 위치를 직접 지정해 주세요."
      : locationStatus === "unsupported"
        ? "브라우저 위치 기능 대신 기준 위치를 직접 지정하면 요메추는 계속 사용할 수 있습니다."
        : "브라우저 위치 권한을 허용하면 가까운 판매처를 자동으로 정렬해 보여드립니다.";
  const locationNoticeHint =
    locationStatus === "invalid"
      ? "기준 위치를 직접 선택하면 요메추 추천은 바로 계속 사용할 수 있어요."
      : locationStatus === "unsupported"
        ? "위치 지정하기로 원하는 동네를 고른 뒤 추천을 받아보세요."
        : "위치 권한을 허용하면 주변 판매처를 자동으로 찾아드립니다.";

  const spinYomechu = useCallback(async () => {
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
    if (!yomechuBaseLocation || !sessionId) {
      setYomechuError(
        "현재 위치를 확인하거나 기준 지역을 선택한 뒤 다시 시도해 주세요."
      );
      setRevealOpen(true);
      return;
    }

    setYomechuLoading(true);
    setYomechuError(null);
    setYomechuResult(null);
    setRevealOpen(true);
    setLauncherOpen(false);

    try {
      const result = await fetchYomechuSpin({
        lat: yomechuBaseLocation.lat,
        lng: yomechuBaseLocation.lng,
        radius_m: selectedRadius,
        category_slug: selectedCategory,
        result_count: selectedCount,
        session_id: sessionId,
      });
      setYomechuResult(result);
    } catch (error) {
      setYomechuError(
        error instanceof Error
          ? error.message
          : "요메추 추천을 불러오지 못했습니다."
      );
    } finally {
      setYomechuLoading(false);
    }
  }, [
    selectedCategory,
    selectedCount,
    selectedRadius,
    sessionId,
    yomechuBaseLocation,
  ]);

  const handleCloseReveal = useCallback(() => {
    if (yomechuResult?.spin_id && sessionId) {
      void sendYomechuFeedback({
        spin_id: yomechuResult.spin_id,
        place_id: yomechuResult.winner.place_id,
        session_id: sessionId,
        event_type: "close",
      });
    }
    setRevealOpen(false);
  }, [sessionId, yomechuResult]);

  const handleBackToLauncher = useCallback(() => {
    if (yomechuResult?.spin_id && sessionId) {
      void sendYomechuFeedback({
        spin_id: yomechuResult.spin_id,
        place_id: yomechuResult.winner.place_id,
        session_id: sessionId,
        event_type: "close",
      });
    }

    setRevealOpen(false);
    setLauncherOpen(true);
  }, [sessionId, yomechuResult]);

  const handleReroll = useCallback(async () => {
    if (yomechuResult?.spin_id && sessionId) {
      void sendYomechuFeedback({
        spin_id: yomechuResult.spin_id,
        place_id: yomechuResult.winner.place_id,
        session_id: sessionId,
        event_type: "reroll",
      });
    }

    await spinYomechu();
  }, [sessionId, spinYomechu, yomechuResult]);

  const handleOpenPlace = useCallback(
    (place: YomechuPlace) => {
      if (yomechuResult?.spin_id && sessionId) {
        void sendYomechuFeedback({
          spin_id: yomechuResult.spin_id,
          place_id: place.place_id,
          session_id: sessionId,
          event_type: "open",
          payload: {
            place_url: place.place_url,
          },
        });
      }

      openExternalUrl(place.place_url);
    },
    [sessionId, yomechuResult]
  );

  const handleShareResult = useCallback(() => {
    if (!yomechuResult?.spin_id) {
      return;
    }

    void sendYomechuFeedback({
      spin_id: yomechuResult.spin_id,
      place_id: yomechuResult.winner.place_id,
      session_id: sessionId || null,
      event_type: "share",
    });
  }, [sessionId, yomechuResult]);

  const mapHref = withAppClipParam("/map", isAppClipExperience);

  return (
    <>
      <Header
        rightSlot={
          <button
            type="button"
            onClick={() => setLauncherOpen((open) => !open)}
            aria-expanded={launcherOpen}
            aria-haspopup="dialog"
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] transition-colors ${
              launcherOpen
                ? "border-primary bg-primary text-white"
                : "border-primary/20 bg-primary/5 text-primary hover:border-primary/40 hover:bg-primary/10"
            }`}
          >
            오늘 뭐 먹지?
          </button>
        }
        bottomSlot={
          launcherOpen ? (
            <YomechuLauncher
              open={launcherOpen}
              locationStatus={locationStatus}
              locationSource={yomechuBaseLocation?.source ?? null}
              locationLabel={yomechuBaseLocation?.label ?? null}
              hasBaseLocation={Boolean(yomechuBaseLocation)}
              selectedRadius={selectedRadius}
              selectedCategory={selectedCategory}
              selectedCount={selectedCount}
              isSubmitting={yomechuLoading}
              error={yomechuError}
              onRadiusChange={setSelectedRadius}
              onCategoryChange={setSelectedCategory}
              onCountChange={setSelectedCount}
              onSpin={spinYomechu}
              onOpenLocationPicker={() => setLocationPickerOpen(true)}
              onRetryLocation={requestUserLocation}
              onUsePresetLocation={handleUsePresetLocation}
            />
          ) : null
        }
      />
      <main className="page-with-bottom-nav max-w-lg mx-auto px-4 py-4">
        {(() => {
          const TOP_COUNT = 10;
          const topTrends = trends.slice(0, TOP_COUNT);
          const outsideTrends = trends.slice(TOP_COUNT);
          const topTrend = topTrends[0];
          const restTop = topTrends.slice(1);
          const risingCount = trends.reduce((acc, trend, idx) => {
            const currentRank = idx + 1;
            if (trend.previous_rank == null) return acc + 1;
            if (trend.previous_rank > currentRank) return acc + 1;
            return acc;
          }, 0);

          return (
            <>
              {/* Dark editorial hero */}
              <section className="mb-5">
                <div className="relative overflow-hidden rounded-3xl bg-hero-top text-white shadow-[0_12px_40px_rgba(20,18,26,0.18)]">
                  <div className="px-5 pb-4 pt-5">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-kicker text-[10px] text-white/90">
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-hero-accent"
                        style={{ boxShadow: "0 0 8px #8B6FE8" }}
                      />
                      Live · 방금 업데이트
                    </div>
                    <h1 className="mt-3 text-[24px] font-extrabold leading-[1.2] tracking-[-0.03em]">
                      SNS에서 뜨는 음식,
                      <br />
                      <span className="text-hero-accent">판매처까지 한 번에.</span>
                    </h1>
                    <div className="mt-4 flex items-center">
                      <div className="flex-1 whitespace-nowrap">
                        <div className="font-kicker text-[9.5px] text-white/55">활성 트렌드</div>
                        <div className="font-kicker mt-0.5 text-[18px] font-extrabold text-white tabular-nums tracking-[-0.02em]">
                          {trends.length}
                        </div>
                      </div>
                      <div className="h-7 w-px flex-shrink-0 bg-white/15" />
                      <div className="flex-1 whitespace-nowrap pl-4">
                        <div className="font-kicker text-[9.5px] text-white/55">검증 판매처</div>
                        <div className="font-kicker mt-0.5 text-[18px] font-extrabold text-white tabular-nums tracking-[-0.02em]">
                          {storeCountLabel}
                        </div>
                      </div>
                      <div className="h-7 w-px flex-shrink-0 bg-white/15" />
                      <div className="flex-1 whitespace-nowrap pl-4">
                        <div className="font-kicker text-[9.5px] text-white/55">상승 중</div>
                        <div className="font-kicker mt-0.5 text-[18px] font-extrabold text-white tabular-nums tracking-[-0.02em]">
                          {risingCount}
                        </div>
                      </div>
                    </div>
                  </div>

                  {topTrend && (
                    <Link
                      href={withAppClipParam(`/trend/${topTrend.id}`, isAppClipExperience)}
                      className="block border-t border-white/10 bg-white/5 px-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-2xl bg-white/10">
                          {topTrend.image_url ? (
                            <Image
                              src={topTrend.image_url}
                              alt={topTrend.name}
                              fill
                              sizes="72px"
                              unoptimized={shouldUseUnoptimizedImage(topTrend.image_url)}
                              className="object-cover"
                              priority
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-hero-accent to-accent text-2xl">
                              🔥
                            </div>
                          )}
                          <span className="font-kicker absolute left-1.5 top-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[9.5px] font-extrabold text-white">
                            #1
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-kicker text-[10px] text-white/65">지금 1위</div>
                          <div className="mt-0.5 text-[17px] font-extrabold tracking-[-0.02em]">
                            {topTrend.name}
                          </div>
                          <div className="truncate text-[11.5px] text-white/70">
                            {topTrend.description || "판매처를 실시간 집계 중이에요"}
                          </div>
                        </div>
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </div>
                    </Link>
                  )}
                </div>
                {lastUpdatedLabel ? (
                  <p
                    className="mt-2 px-1 text-[11px] text-ink4"
                    suppressHydrationWarning
                  >
                    최근 트렌드 업데이트: {lastUpdatedLabel}
                  </p>
                ) : null}
              </section>

              {/* Yomechu promo row */}
              <button
                type="button"
                onClick={() => setLauncherOpen(true)}
                className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:bg-accent-soft/40"
              >
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="8.5" cy="9" r="1.4" fill="currentColor" />
                    <circle cx="15.5" cy="9" r="1.4" fill="currentColor" />
                    <path d="M8 15c1 1.2 2.5 1.8 4 1.8s3-.6 4-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold tracking-[-0.02em] text-ink">
                    오늘 뭐 먹지?
                  </span>
                  <span className="block text-[11.5px] text-ink4">
                    주변 식당을 룰렛으로 골라드려요
                  </span>
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-ink4">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>

              {!isAppClipExperience ? (
                <section className="mb-5">
                  <div className="flex justify-center">
                    <PushSubscribeButton />
                  </div>
                  <InstallPrompt />
                </section>
              ) : null}

              <div id="trends" className="scroll-mt-24">
                {loading ? (
                  <section>
                    <div className="flex flex-col gap-3">
                      {[1, 2, 3].map((index) => (
                        <div
                          key={index}
                          className="h-16 animate-pulse rounded-2xl bg-surface"
                        />
                      ))}
                    </div>
                  </section>
                ) : trends.length === 0 ? (
                  <section>
                    <div className="rounded-2xl border border-line bg-surface py-12 text-center">
                      <p className="text-[14px] font-bold text-ink">
                        아직 유행하는 음식을 찾는 중이에요
                      </p>
                      <p className="mt-2 text-[12px] text-ink4">
                        크롤러가 SNS를 탐색하는 중입니다
                      </p>
                    </div>
                  </section>
                ) : (
                  <>
                    {/* Ranked list (TOP) */}
                    <section className="mb-8">
                      <div className="mb-3 flex items-baseline justify-between px-1">
                        <div>
                          <div className="font-kicker text-[10px] text-accent">Trend Ranking</div>
                          <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.03em] text-ink">
                            이번 주 TOP {topTrends.length}
                          </h2>
                        </div>
                      </div>

                      {restTop.length > 0 && (
                        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                          {restTop.map((trend, index) => {
                            const rank = index + 2;
                            const score = Math.min(Math.max(trend.peak_score || 0, 0), 100);
                            const isLast = index === restTop.length - 1;
                            return (
                              <Link
                                key={trend.id}
                                href={withAppClipParam(
                                  `/trend/${trend.id}`,
                                  isAppClipExperience
                                )}
                                className={`flex w-full items-center gap-3 px-3 py-3 transition-colors hover:bg-bg ${
                                  isLast ? "" : "border-b border-line2"
                                }`}
                              >
                                <span className="font-kicker w-7 flex-shrink-0 text-[18px] font-bold text-ink3 tabular-nums">
                                  {String(rank).padStart(2, "0")}
                                </span>
                                <div className="relative h-[52px] w-[52px] flex-shrink-0 overflow-hidden rounded-xl bg-bg">
                                  {trend.image_url ? (
                                    <Image
                                      src={trend.image_url}
                                      alt={trend.name}
                                      fill
                                      sizes="52px"
                                      unoptimized={shouldUseUnoptimizedImage(trend.image_url)}
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent-soft to-bg" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <span className="min-w-0 truncate text-[15px] font-bold tracking-[-0.02em] text-ink">
                                      {trend.name}
                                    </span>
                                    <RankDeltaBadge trend={trend} currentRank={rank} />
                                  </div>
                                  <div className="mt-0.5 truncate text-[11.5px] text-ink4">
                                    {trend.category} · 판매처 {trend.store_count || 0}곳
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className="font-kicker text-[13px] font-bold text-ink tabular-nums">
                                    {score}
                                  </span>
                                  <span className="h-1 w-12 overflow-hidden rounded-full bg-line2">
                                    <span
                                      className="block h-full bg-accent"
                                      style={{ width: `${score}%` }}
                                    />
                                  </span>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    {outsideTrends.length > 0 && (
                      <section className="mb-6">
                        <div className="mb-3 flex items-center justify-between px-1">
                          <h3 className="text-[14px] font-bold text-ink3">순위권 밖</h3>
                          <span className="text-[11px] text-ink4">{outsideTrends.length}개</span>
                        </div>
                        <div className="flex flex-col gap-8">
                          {outsideTrends.map((trend) => (
                            <TrendCard key={trend.id} trend={trend} />
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>
            </>
          );
        })()}

        <section className="mb-6 mt-8">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <div>
              <div className="font-kicker text-[10px] text-accent">Editorial</div>
              <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.03em] text-ink">
                어떻게 고르나요?
              </h2>
            </div>
            <Link
              href="/editorial-policy"
              className="text-[11.5px] font-semibold text-ink3 hover:text-ink"
            >
              기준 자세히 &gt;
            </Link>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="break-keep text-[13.5px] leading-[1.6] tracking-[-0.01em] text-ink2">
              공식 채널, 실제 판매 여부, 출처 공개. 세 가지 기준만 먼저 봅니다.
              굿즈·이벤트 항목은 제외되고, 먹을 수 있는 메뉴만 올라옵니다.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { n: "01", t: "공식 채널 먼저", href: "/how-it-works" },
                { n: "02", t: "판매 여부 확인", href: "/editorial-policy" },
                { n: "03", t: "출처 공개", href: "/data-sources" },
              ].map((x) => (
                <Link
                  key={x.n}
                  href={x.href}
                  className="rounded-xl border border-line bg-bg px-3 py-3 transition-colors hover:bg-accent-soft/50"
                >
                  <p className="font-kicker text-[10px] text-accent">{x.n}</p>
                  <p className="mt-1.5 break-keep text-[12px] font-bold tracking-[-0.02em] text-ink">
                    {x.t}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {showLocationNotice ? (
          <section className="mb-6 mt-8">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-sm font-semibold text-amber-900">
                {locationNoticeTitle}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-amber-800">
                {locationNoticeDescription}
              </p>
              <p className="mt-2 text-xs leading-5 text-amber-700">
                {locationNoticeHint}
              </p>
              <div className="mt-3 flex gap-2">
                {locationStatus === "unsupported" ? (
                  <button
                    onClick={() => setLocationPickerOpen(true)}
                    className="inline-flex rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-950"
                  >
                    기준 위치 선택하기
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        const perm = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
                        if (perm?.state === "denied") {
                          alert("위치 권한이 차단되어 있습니다.\n\n[설정 방법]\n• 브라우저: 주소창 🔒 아이콘 → 위치 → 허용\n• 앱(PWA): 기기 설정 → 앱 → 브라우저 → 위치 권한 허용\n\n변경 후 새로고침해 주세요.");
                          return;
                        }
                      } catch {}
                      requestUserLocation();
                    }}
                    className="inline-flex rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-950"
                  >
                    {locationStatus === "invalid"
                      ? "현재 위치 다시 확인하기"
                      : "위치 권한 허용하기"}
                  </button>
                )}
                <Link
                  href={mapHref}
                  className="inline-flex rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                >
                  지도에서 보기
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {nearbyStores.length > 0 ? (
          <section className="mb-6 mt-8">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">내 근처 판매처</h3>
                <p className="mt-1 text-xs text-gray-500">
                  트렌드를 확인했다면, 이제 가까운 판매처를 바로 찾아보세요.
                </p>
              </div>
              <Link href={mapHref} className="text-xs text-primary font-medium">
                지도에서 보기
              </Link>
            </div>
            <div className="space-y-2">
              {nearbyStores.map((store) => (
                <div
                  key={store.place_url || `${store.name}-${store.address}`}
                  className="bg-white rounded-xl border border-gray-100 p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="min-w-0 flex-1 font-semibold text-sm text-gray-900 truncate">
                          {store.name}
                        </h4>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{store.address}</p>
                      {store.trend_names.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {getVisibleTrendNames(store.trend_names).map((trendName) => (
                            <span
                              key={trendName}
                              className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                            >
                              {trendName}
                            </span>
                          ))}
                          {store.trend_names.length > 2 ? (
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                              외 {store.trend_names.length - 2}개
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <span className="inline-flex h-5 shrink-0 self-center items-center justify-center whitespace-nowrap pt-px text-xs font-semibold leading-none text-primary">
                      {formatDistanceMeters(
                        Math.max(Math.round(store.distance_km * 1000), 0)
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <AdSlot slot={ADSENSE_HOME_SLOT} className="mt-8" />

        {!isAppClipExperience ? <Footer /> : null}
      </main>
      <ScrollToTop />
      {locationPickerOpen ? (
        <YomechuLocationPickerModal
          isOpen={locationPickerOpen}
          initialCenter={locationPickerInitialCenter}
          initialLabel={yomechuBaseLocation?.label ?? null}
          onClose={() => setLocationPickerOpen(false)}
          onConfirm={handleConfirmManualLocation}
        />
      ) : null}
      {revealOpen ? (
        <YomechuRevealModal
          isOpen={revealOpen}
          isLoading={yomechuLoading}
          error={yomechuError}
          result={yomechuResult}
          onBack={handleBackToLauncher}
          onClose={handleCloseReveal}
          onReroll={handleReroll}
          onOpenPlace={handleOpenPlace}
          onShare={handleShareResult}
          shareUrl={
            yomechuResult?.spin_id
              ? buildYomechuShareUrl(yomechuResult.spin_id)
              : null
          }
        />
      ) : null}
      <BottomNav />
    </>
  );
}
