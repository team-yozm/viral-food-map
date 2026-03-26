"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import InstallPrompt from "@/components/InstallPrompt";
import TrendCard from "@/components/TrendCard";
import YomechuLauncher from "@/components/YomechuLauncher";
import YomechuRevealModal from "@/components/YomechuRevealModal";
import {
  fetchYomechuSpin,
  formatDistanceMeters,
  sendYomechuFeedback,
} from "@/lib/crawler";
import { supabase } from "@/lib/supabase";
import type {
  LocationStatus,
  NearbyTrendStore,
  Trend,
  YomechuCategorySlug,
  YomechuPlace,
  YomechuSpinResponse,
} from "@/lib/types";

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}`;
}

export default function HomePageClient() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [nearbyStores, setNearbyStores] = useState<NearbyTrendStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [sessionId, setSessionId] = useState("");
  const [selectedRadius, setSelectedRadius] = useState(1000);
  const [selectedCategory, setSelectedCategory] =
    useState<YomechuCategorySlug>("all");
  const [yomechuLoading, setYomechuLoading] = useState(false);
  const [yomechuError, setYomechuError] = useState<string | null>(null);
  const [yomechuResult, setYomechuResult] = useState<YomechuSpinResponse | null>(
    null
  );
  const [revealOpen, setRevealOpen] = useState(false);

  const requestUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      return;
    }

    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLoc({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus("granted");
      },
      () => {
        setUserLoc(null);
        setLocationStatus("denied");
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      }
    );
  }, []);

  const fetchTrends = useCallback(async () => {
    const { data } = await supabase
      .from("trends")
      .select("*, stores(count)")
      .in("status", ["rising", "active"])
      .order("peak_score", { ascending: false });

    if (data) {
      setTrends(
        data.map((trend: Trend & { stores?: { count: number }[] | null }) => ({
          ...trend,
          store_count: trend.stores?.[0]?.count ?? 0,
        }))
      );
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
    fetchTrends();

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
  }, [fetchTrends, requestUserLocation]);

  useEffect(() => {
    if (!userLoc) return;

    const fetchNearbyStores = async () => {
      const { data } = await supabase.rpc("get_nearby_trend_stores", {
        user_lat: userLoc.lat,
        user_lng: userLoc.lng,
        result_limit: 5,
      });

      setNearbyStores((data as NearbyTrendStore[]) ?? []);
    };

    fetchNearbyStores();
  }, [userLoc]);

  const spinYomechu = useCallback(async () => {
    if (!userLoc || !sessionId) {
      setYomechuError("현재 위치를 확인한 뒤 다시 시도해 주세요.");
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
        lat: userLoc.lat,
        lng: userLoc.lng,
        radius_m: selectedRadius,
        category_slug: selectedCategory,
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
  }, [selectedCategory, selectedRadius, sessionId, userLoc]);

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

      window.open(place.place_url, "_blank", "noopener,noreferrer");
    },
    [sessionId, yomechuResult]
  );

  return (
    <>
      <Header
        logoMode="launcher"
        onLogoClick={() => setLauncherOpen((open) => !open)}
        launcherOpen={launcherOpen}
        launcher={
          <YomechuLauncher
            open={launcherOpen}
            locationStatus={locationStatus}
            selectedRadius={selectedRadius}
            selectedCategory={selectedCategory}
            isSubmitting={yomechuLoading}
            error={yomechuError}
            onRadiusChange={setSelectedRadius}
            onCategoryChange={setSelectedCategory}
            onSpin={spinYomechu}
            onRetryLocation={requestUserLocation}
          />
        }
      />

      <main className="max-w-lg mx-auto px-4 py-4">
        <section className="mb-6">
          <div className="overflow-hidden rounded-[32px] border border-white/60 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.45),_transparent_35%),linear-gradient(140deg,_#8f73d1_0%,_#b17dce_45%,_#6f9ed6_100%)] px-6 py-8 text-white shadow-[0_28px_54px_rgba(155,125,212,0.28)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
              Viral Food Map
            </p>
            <h2 className="mt-2 text-[42px] font-black leading-tight tracking-[-0.06em]">
              요즘 뜨는 메뉴와
              <br />
              지금 갈 한 곳
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/82">
              SNS 바이럴 메뉴는 아래에서 확인하고, 로고를 눌러 요메추로 지금
              근처 한 곳을 바로 골라보세요.
            </p>
          </div>
        </section>

        <InstallPrompt />

        {nearbyStores.length > 0 ? (
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">내 주변 트렌드 판매처</h3>
              <Link href="/map" className="text-xs font-medium text-primary">
                지도에서 보기
              </Link>
            </div>
            <div className="space-y-2">
              {nearbyStores.map((store) => (
                <div
                  key={store.id}
                  className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg">
                    🍽️
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-sm font-semibold text-gray-900">
                        {store.name}
                      </h4>
                      {store.trend_name ? (
                        <span className="flex-shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                          {store.trend_name}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-gray-400">{store.address}</p>
                  </div>
                  <span className="flex-shrink-0 text-xs font-semibold text-primary">
                    {formatDistanceMeters(
                      Math.max(Math.round(store.distance_km * 1000), 0)
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">트렌드 목록</h3>
            <span className="text-xs text-gray-400">{trends.length}개 트렌드</span>
          </div>

          {loading ? (
            <div className="flex flex-col gap-8">
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-2xl bg-white p-4"
                />
              ))}
            </div>
          ) : trends.length === 0 ? (
            <div className="py-14 text-center text-gray-400">
              <p className="mb-4 text-5xl">🍜</p>
              <p className="text-base font-semibold text-gray-600">
                아직 탐지된 푸드 트렌드가 없어요.
              </p>
              <p className="mt-2 text-sm text-gray-400">
                크롤러가 SNS와 검색량을 계속 추적 중입니다.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {trends.map((trend) => (
                <TrendCard key={trend.id} trend={trend} />
              ))}
            </div>
          )}
        </section>

        <Footer />
      </main>

      <YomechuRevealModal
        isOpen={revealOpen}
        isLoading={yomechuLoading}
        error={yomechuError}
        result={yomechuResult}
        onClose={handleCloseReveal}
        onReroll={handleReroll}
        onOpenPlace={handleOpenPlace}
      />

      <BottomNav />
    </>
  );
}
