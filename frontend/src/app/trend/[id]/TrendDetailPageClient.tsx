"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import KakaoMap from "@/components/KakaoMap";
import ScrollToTop from "@/components/ScrollToTop";
import StoreList from "@/components/StoreList";
import TrendBadge from "@/components/TrendBadge";
import ShareButton from "@/components/ShareButton";
import type { Trend, Store } from "@/lib/types";

interface TrendDetailPageClientProps {
  id: string;
  initialTrend: Trend | null;
  initialStores: Store[];
}

function VolumeChart({ data }: { data: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(...entries.map(([, v]) => v), 1);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  if (!entries.length) return null;

  return (
    <div className="mt-1">
      <button
        onClick={toggle}
        className="text-xs text-primary flex items-center gap-1"
      >
        📈 검색 관심도 {open ? "접기 ▲" : "보기 ▼"}
      </button>
      {open && (
        <div className="mt-2 bg-gray-50 rounded-xl px-3 pt-3 pb-2">
          <div className="flex items-end gap-1 h-14">
            {entries.map(([date, val]) => (
              <div key={date} className="flex flex-col items-center flex-1 gap-1">
                <div
                  className="w-full bg-primary rounded-t-sm opacity-70"
                  style={{ height: `${Math.max((val / max) * 100, 4)}%` }}
                />
                <span className="text-[9px] text-gray-400">{date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
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

export default function TrendDetailPageClient({
  id,
  initialTrend,
  initialStores,
}: TrendDetailPageClientProps) {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [storeQuery, setStoreQuery] = useState("");
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const normalizedStoreQuery = storeQuery.trim().toLowerCase();
  const totalStoreCount = initialStores.length;

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  const sortedStores = useMemo(() => {
    return userLoc
      ? [...initialStores].sort(
          (a, b) =>
            getDistance(userLoc.lat, userLoc.lng, a.lat, a.lng) -
            getDistance(userLoc.lat, userLoc.lng, b.lat, b.lng)
        )
      : initialStores;
  }, [initialStores, userLoc]);

  const filteredStores = useMemo(() => {
    if (!normalizedStoreQuery) return sortedStores;
    return sortedStores.filter(
      (store) =>
        store.name.toLowerCase().includes(normalizedStoreQuery) ||
        store.address.toLowerCase().includes(normalizedStoreQuery)
    );
  }, [normalizedStoreQuery, sortedStores]);

  const nearestStore = filteredStores[0] ?? sortedStores[0];
  const mapCenter = nearestStore
    ? { lat: nearestStore.lat, lng: nearestStore.lng }
    : { lat: 37.5665, lng: 126.978 };
  const showStoreSearch = totalStoreCount > 3;
  const hasActiveSearch = normalizedStoreQuery.length > 0;
  const storeCountLabel = hasActiveSearch
    ? `검색 결과 ${filteredStores.length}곳 / 전체 ${totalStoreCount}곳`
    : `판매처 ${totalStoreCount}곳`;

  if (!initialTrend) {
    return (
      <>
        <Header showBack />
        <main className="max-w-lg mx-auto px-4 py-12 text-center text-gray-400">
          <p className="text-4xl mb-3">😅</p>
          <p>트렌드를 찾을 수 없어요</p>
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Header showBack />
      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-gray-900">{initialTrend.name}</h2>
            <TrendBadge status={initialTrend.status} />
          </div>
          <p className="text-sm text-gray-500">
            {initialTrend.description || "이 트렌드는 최근 감지되어 상세 정보를 준비 중입니다. 판매처를 알고 계시면 제보해주세요!"}
          </p>
          {initialTrend.search_volume_data &&
            Object.keys(initialTrend.search_volume_data).length > 0 && (
              <VolumeChart data={initialTrend.search_volume_data} />
            )}
          <p className="text-xs text-gray-400 mt-1 mb-3">
            {initialTrend.detected_at &&
              `${new Date(initialTrend.detected_at).toLocaleDateString("ko-KR")} 감지`}{" "}
            · 판매처 {totalStoreCount}곳
          </p>
          <ShareButton
            title={`${initialTrend.name} - 요즘뭐먹`}
            description={initialTrend.description ?? undefined}
            imageUrl={initialTrend.image_url ?? undefined}
          />
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-bold text-gray-900">지도에서 판매처 찾기</h3>
              <p className="text-xs text-gray-500 mt-1">{storeCountLabel}</p>
            </div>
            <Link href={`/report?trend=${id}`} className="text-xs text-primary font-medium">
              + 제보하기
            </Link>
          </div>
          {showStoreSearch && (
            <div className="mb-3">
              <input
                type="text"
                value={storeQuery}
                onChange={(e) => setStoreQuery(e.target.value)}
                placeholder="판매처 이름이나 주소 검색"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
          {hasActiveSearch && filteredStores.length === 0 && (
            <p className="mb-3 text-xs text-amber-700">
              검색 결과가 없어 지도에는 표시할 판매처가 없습니다. 다른 이름이나 주소로 다시 찾아보세요.
            </p>
          )}
          <KakaoMap
            stores={filteredStores}
            center={mapCenter}
            level={5}
            autoFitBounds={false}
            selectedStoreId={selectedStoreId}
            onMarkerClick={setSelectedStoreId}
          />
        </div>

        <div className="pb-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900">판매처 목록</h3>
            <p className="text-xs text-gray-500">{storeCountLabel}</p>
          </div>
          <StoreList
            stores={filteredStores}
            userLoc={userLoc}
            selectedStoreId={selectedStoreId}
            onStoreClick={setSelectedStoreId}
            emptyTitle={
              hasActiveSearch && totalStoreCount > 0
                ? "검색 결과가 없어요"
                : "아직 등록된 판매처가 없어요"
            }
            emptyDescription={
              hasActiveSearch && totalStoreCount > 0
                ? "다른 판매처 이름이나 주소로 다시 찾아보세요."
                : "제보 탭에서 알려주세요!"
            }
          />
        </div>
      </main>
      <BottomNav />
      <ScrollToTop />
    </>
  );
}
