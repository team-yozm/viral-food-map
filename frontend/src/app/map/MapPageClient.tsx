"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type WheelEvent,
} from "react";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import BottomNav from "@/components/BottomNav";
import KakaoMap, { type MapBounds } from "@/components/KakaoMap";
import { ADSENSE_MAP_SLOT } from "@/lib/adsense";
import { openExternalUrl, openInstagramTag } from "@/lib/external-links";
import { supabase } from "@/lib/supabase";
import type { Store, Trend } from "@/lib/types";
import { getCurrentPosition } from "@/lib/native-geolocation";

interface MapPageClientProps {
  initialTrends: Trend[];
}

type MapStore = Store & {
  trend_name?: string | null;
};

type UserLocation = {
  lat: number;
  lng: number;
};

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-semibold tracking-[-0.01em] transition-colors ${
        active
          ? "bg-ink text-surface"
          : "bg-surface text-ink2 ring-1 ring-inset ring-line"
      }`}
    >
      {label}
    </button>
  );
}

export default function MapPageClient({ initialTrends }: MapPageClientProps) {
  const [trends, setTrends] = useState<Trend[]>(initialTrends);
  const [stores, setStores] = useState<MapStore[]>([]);
  const [selectedTrendId, setSelectedTrendId] = useState<string | "all">("all");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [storeQuery, setStoreQuery] = useState("");
  const [franchiseFilter, setFranchiseFilter] = useState<
    "all" | "franchise" | "independent"
  >("all");
  const [userLoc, setUserLoc] = useState<UserLocation | null>(null);
  const [locReady, setLocReady] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const trendChipDragRef = useRef({ didDrag: false });

  const requestLocation = useCallback(
    () =>
      getCurrentPosition({ timeout: 5000 })
        .then((nextLocation) => {
          setUserLoc(nextLocation);
          setLocationMessage(null);
          setLocReady(true);
          return nextLocation as UserLocation;
        })
        .catch(() => {
          const fallbackLocation = { lat: 37.5665, lng: 126.978 };
          setUserLoc(fallbackLocation);
          setLocationMessage("위치 권한이 없어 서울 시청 기준으로 표시 중입니다.");
          setLocReady(true);
          return fallbackLocation as UserLocation;
        }),
    []
  );

  const fetchTrends = useCallback(async () => {
    const { data } = await supabase
      .from("trends")
      .select("*")
      .in("status", ["rising", "active", "declining"])
      .order("peak_score", { ascending: false })
      .order("id", { ascending: true });

    if (data) {
      setTrends(data as Trend[]);
    }
  }, []);

  useEffect(() => {
    void requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    void fetchTrends();
  }, [fetchTrends]);

  useEffect(() => {
    if (!mapBounds) return;

    let query = supabase
      .from("stores")
      .select(
        "id, name, address, lat, lng, phone, place_url, rating, source, verified, is_franchise, last_updated, trend_id, trends(name)"
      )
      .gte("lat", mapBounds.sw.lat)
      .lte("lat", mapBounds.ne.lat)
      .gte("lng", mapBounds.sw.lng)
      .lte("lng", mapBounds.ne.lng)
      .limit(300);

    if (selectedTrendId !== "all") {
      query = query.eq("trend_id", selectedTrendId);
    } else if (trends.length > 0) {
      query = query.in(
        "trend_id",
        trends.map((t) => t.id)
      );
    }

    query.then(({ data }) => {
      if (data) {
        setStores(
          data.map((store: any) => ({
            ...store,
            is_franchise: Boolean(store.is_franchise),
            trend_name: store.trends?.name,
          })) as MapStore[]
        );
      }
    });
  }, [mapBounds, selectedTrendId]);

  const filteredStores = useMemo(() => {
    let result = stores;
    if (franchiseFilter === "franchise") {
      result = result.filter((s) => s.is_franchise);
    } else if (franchiseFilter === "independent") {
      result = result.filter((s) => !s.is_franchise);
    }
    if (!storeQuery.trim()) return result;
    const q = storeQuery.trim().toLowerCase();
    return result.filter(
      (store) =>
        store.name.toLowerCase().includes(q) ||
        store.address.toLowerCase().includes(q)
    );
  }, [stores, storeQuery, franchiseFilter]);

  useEffect(() => {
    if (!selectedStoreId) return;
    if (filteredStores.some((store) => store.id === selectedStoreId)) return;
    setSelectedStoreId(null);
  }, [filteredStores, selectedStoreId]);

  const trendLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of trends) map[t.id] = t.name;
    return map;
  }, [trends]);

  const hasStoreQuery = storeQuery.trim().length > 0;
  const showSearchInput = stores.length > 3 || hasStoreQuery;

  function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDistance(km: number) {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return km >= 100 ? `${Math.round(km)}km` : `${km.toFixed(1)}km`;
  }

  const handleTrendChipsWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const scroller = event.currentTarget;
    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    if (maxScrollLeft <= 0) return;

    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
    if (delta === 0) return;

    const nextScrollLeft = Math.min(
      maxScrollLeft,
      Math.max(0, scroller.scrollLeft + delta)
    );
    if (nextScrollLeft === scroller.scrollLeft) return;

    event.preventDefault();
    scroller.scrollLeft = nextScrollLeft;
  }, []);

  const handleTrendChipsMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;

      const scroller = event.currentTarget;
      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
      if (maxScrollLeft <= 0) return;

      const startX = event.clientX;
      const startScrollLeft = scroller.scrollLeft;
      let didDrag = false;

      trendChipDragRef.current.didDrag = false;

      const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        if (!didDrag && Math.abs(deltaX) < 5) return;

        didDrag = true;
        trendChipDragRef.current.didDrag = true;
        moveEvent.preventDefault();
        scroller.scrollLeft = Math.min(
          maxScrollLeft,
          Math.max(0, startScrollLeft - deltaX)
        );
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.setTimeout(() => {
          trendChipDragRef.current.didDrag = false;
        }, 100);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    []
  );

  const handleTrendChipsClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!trendChipDragRef.current.didDrag) return;

      event.preventDefault();
      event.stopPropagation();
      trendChipDragRef.current.didDrag = false;
    },
    []
  );

  return (
    <>
      <main
        className="page-with-bottom-nav mx-auto flex max-w-lg flex-col bg-bg"
        style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}
      >
        {/* Title row */}
        <div className="px-5 pb-3 pt-2">
          <div className="flex items-baseline justify-between">
            <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-ink">
              주변 판매처
            </h1>
            <span className="whitespace-nowrap text-[11px] tracking-[-0.01em] text-ink4">
              {userLoc ? "내 위치 기준" : "서울 기준"}
            </span>
          </div>
        </div>

        {/* Trend filter chips */}
        <div
          className="scrollbar-hide flex w-full min-w-0 cursor-grab gap-1.5 overflow-x-auto overscroll-x-contain px-5 pb-2.5 active:cursor-grabbing"
          onClickCapture={handleTrendChipsClickCapture}
          onMouseDown={handleTrendChipsMouseDown}
          onWheel={handleTrendChipsWheel}
        >
          <Chip
            label="전체 트렌드"
            active={selectedTrendId === "all"}
            onClick={() => setSelectedTrendId("all")}
          />
          {trends.map((trend) => (
            <Chip
              key={trend.id}
              label={trend.name}
              active={selectedTrendId === trend.id}
              onClick={() => setSelectedTrendId(trend.id)}
            />
          ))}
        </div>

        {/* Map with report FAB */}
        <div className="relative mx-4 overflow-hidden rounded-[20px] border border-line">
          {locReady && userLoc ? (
            <KakaoMap
              stores={filteredStores}
              center={userLoc}
              currentLocation={userLoc}
              level={7}
              className="map-container !h-[50vh]"
              selectedStoreId={selectedStoreId}
              onMarkerClick={setSelectedStoreId}
              onBoundsChange={setMapBounds}
              autoFitBounds={false}
              onRequestCurrentLocation={requestLocation}
              trendLabels={trendLabels}
            />
          ) : (
            <div className="flex h-[50vh] items-center justify-center bg-bg">
              <p className="text-sm text-ink4">위치 확인 중...</p>
            </div>
          )}
          <Link
            href="/report"
            className="absolute right-3 top-3 z-[5] inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-[11.5px] font-bold text-surface shadow-[0_6px_16px_rgba(0,0,0,0.18)] transition-transform active:scale-95"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            판매처 제보
          </Link>
        </div>

        {locationMessage ? (
          <div className="mx-4 mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900">
              {locationMessage}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              브라우저 위치 권한을 허용하면 내 주변 판매처 기준으로 다시 보여드립니다.
            </p>
            <button
              type="button"
              onClick={() => {
                void requestLocation();
              }}
              className="mt-3 rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white"
            >
              현재 위치 다시 시도
            </button>
          </div>
        ) : null}

        {/* Kind filter */}
        <div className="flex gap-1.5 px-5 pb-2.5 pt-3.5">
          {(["all", "franchise", "independent"] as const).map((val) => {
            const label =
              val === "all"
                ? `전체 ${stores.length}`
                : val === "franchise"
                  ? "프랜차이즈"
                  : "개인";
            return (
              <Chip
                key={val}
                label={label}
                active={franchiseFilter === val}
                onClick={() => setFranchiseFilter(val)}
              />
            );
          })}
        </div>

        {/* Search input */}
        {showSearchInput ? (
          <div className="px-4 pb-2">
            <input
              type="text"
              value={storeQuery}
              onChange={(e) => setStoreQuery(e.target.value)}
              placeholder="판매처 이름이나 주소 검색"
              className="w-full rounded-[14px] border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink4 focus:border-accent focus:outline-none"
            />
          </div>
        ) : null}

        {/* Store list */}
        <div className="flex-1 px-4 pb-5 pt-1">
          {filteredStores.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-line bg-surface px-4 py-10 text-center">
              <p className="text-sm font-bold text-ink">
                {hasStoreQuery && stores.length > 0
                  ? "검색 결과와 일치하는 판매처가 없습니다."
                  : "현재 지도 범위에 판매처가 없습니다."}
              </p>
              <p className="mt-1 text-sm text-ink3">
                {hasStoreQuery && stores.length > 0
                  ? "다른 이름이나 주소로 다시 검색해 보세요."
                  : "지도를 이동하거나 다른 트렌드를 선택해 보세요."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredStores.map((store) => {
                const distanceKm = userLoc
                  ? getDistance(userLoc.lat, userLoc.lng, store.lat, store.lng)
                  : null;
                const isSelected = store.id === selectedStoreId;
                const placeUrl =
                  store.place_url ||
                  `https://map.naver.com/p/search/${encodeURIComponent(store.name)}`;
                const isKakao = placeUrl.includes("kakao");
                const isNaver = placeUrl.includes("naver");
                const mapLabel = isKakao
                  ? "카카오"
                  : isNaver
                    ? "네이버"
                    : "지도";
                const mapBtnCls = isKakao
                  ? "bg-[#FEE500] text-[#3C1E1E]"
                  : isNaver
                    ? "bg-[#03C75A] text-white"
                    : "bg-ink3 text-surface";
                return (
                  <button
                    key={store.id}
                    type="button"
                    id={`store-${store.id}`}
                    onClick={() => setSelectedStoreId(store.id)}
                    className={`flex w-full items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-accent bg-accent-soft"
                        : "border-line bg-surface hover:border-ink4"
                    }`}
                  >
                    <div className="font-kicker w-[54px] shrink-0 text-center text-xs font-bold text-accent tabular-nums">
                      {distanceKm !== null ? formatDistance(distanceKm) : "—"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold tracking-[-0.01em] text-ink">
                          {store.name}
                        </span>
                        {store.is_franchise ? (
                          <span className="shrink-0 rounded bg-line2 px-1.5 py-0.5 text-[9.5px] font-bold text-ink3">
                            프랜차이즈
                          </span>
                        ) : (
                          <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-bold text-accent-ink">
                            개인
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-ink4">
                        {store.address}
                      </div>
                      <div className="mt-1.5 flex gap-1">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openExternalUrl(placeUrl);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              openExternalUrl(placeUrl);
                            }
                          }}
                          className={`inline-flex h-5 cursor-pointer items-center rounded-md px-1.5 text-[10px] font-bold ${mapBtnCls}`}
                        >
                          {mapLabel}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openInstagramTag(store.name);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              openInstagramTag(store.name);
                            }
                          }}
                          className="inline-flex h-5 cursor-pointer items-center rounded-md bg-gradient-to-r from-purple-500 to-pink-500 px-1.5 text-[10px] font-bold text-white"
                        >
                          인스타
                        </span>
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
                      className="shrink-0 self-center text-ink4"
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <AdSlot slot={ADSENSE_MAP_SLOT} />
        </div>
      </main>
      <BottomNav />
    </>
  );
}
