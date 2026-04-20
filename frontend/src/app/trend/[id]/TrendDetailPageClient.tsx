"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import KakaoMap from "@/components/KakaoMap";
import ScrollToTop from "@/components/ScrollToTop";
import ShareButton from "@/components/ShareButton";
import StoreList from "@/components/StoreList";
import TrendBadge from "@/components/TrendBadge";
import { ADSENSE_TREND_DETAIL_SLOT } from "@/lib/adsense";
import useAppClipExperience from "@/hooks/useAppClipExperience";
import { withAppClipParam } from "@/lib/app-clip";
import { getCurrentPosition } from "@/lib/native-geolocation";
import {
  formatTrendDetectedDate,
  getTrendCategorySummary,
  getTrendStatusSummary,
} from "@/lib/trend-indexing";
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

function VolumeChart({ data }: { data: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(...entries.map(([, value]) => value), 1);

  if (!entries.length) {
    return null;
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1 text-xs text-primary"
      >
        검색 관심도 {open ? "닫기" : "보기"}
      </button>
      {open ? (
        <div className="mt-2 rounded-xl bg-gray-50 px-3 pb-2 pt-3">
          <div className="flex h-14 items-end gap-1">
            {entries.map(([date, value]) => (
              <div key={date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm bg-primary opacity-70"
                  style={{ height: `${Math.max((value / max) * 100, 4)}%` }}
                />
                <span className="text-[9px] text-gray-400">{date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

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

function getMomentumSummary(peakScore: number): string {
  if (peakScore >= 85) {
    return "최근 검색 반응이 빠르게 붙는 강한 구간으로 볼 수 있습니다.";
  }

  if (peakScore >= 60) {
    return "반응 강도가 꾸준히 유지되는 중간 이상 구간입니다.";
  }

  return "반응 강도가 아주 높지 않아도 실제 판매처 탐색 수요는 남아 있을 수 있습니다.";
}

function getStoreCoverageSummary(storeCount: number): string {
  if (storeCount >= 10) {
    return "확인 가능한 판매처 수가 비교적 넉넉한 편이라 지도 탐색 활용도가 높습니다.";
  }

  if (storeCount >= 3) {
    return "판매처가 어느 정도 확보돼 있어 가까운 매장을 찾기에 적합한 상태입니다.";
  }

  if (storeCount > 0) {
    return "판매처 데이터가 많지 않아 추가 제보와 보강이 계속 필요한 상태입니다.";
  }

  return "현재 공개된 판매처 데이터가 거의 없어 탐색형 페이지 성격이 더 강합니다.";
}

export default function TrendDetailPageClient({
  id,
  initialTrend,
  initialStores,
}: TrendDetailPageClientProps) {
  const isAppClipExperience = useAppClipExperience();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [storeQuery, setStoreQuery] = useState("");
  const [userLoc, setUserLoc] = useState<UserLocation | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [canRetryLocation, setCanRetryLocation] = useState(false);

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

  const detectedLabel = formatTrendDetectedDate(initialTrend?.detected_at);
  const editorialNotes = useMemo(() => {
    if (!initialTrend) {
      return null;
    }

    const storeCount = sortedStores.length;

    return {
      overview: [
        `${initialTrend.name}은 ${detectedLabel} 기준으로 최근 데이터 흐름에서 다시 포착된 메뉴입니다.`,
        getTrendStatusSummary(initialTrend.status),
        getTrendCategorySummary(initialTrend.category),
        getMomentumSummary(initialTrend.peak_score),
      ],
      usage: [
        getStoreCoverageSummary(storeCount),
        "지도와 판매처 목록은 탐색을 돕기 위한 참고 정보입니다. 실제 판매 여부나 재고는 방문 전에 다시 확인하는 것이 좋습니다.",
        "매장이 빠졌거나 종료된 경우에는 제보 기능을 통해 수정 요청을 남길 수 있습니다.",
      ],
      operations: [
        "트렌드 상태는 검색 반응과 최근 언급 흐름을 함께 보고 갱신합니다.",
        "판매처 정보는 지도 검색과 사용자 제보를 함께 사용하며, 제보는 검수 후 반영합니다.",
        "설명이 빈약한 페이지는 검색 노출 범위를 줄이고 내부 탐색용으로 먼저 운영할 수 있습니다.",
      ],
    };
  }, [detectedLabel, initialTrend, sortedStores.length]);

  if (!initialTrend) {
    return (
      <>
        <Header showBack />
        <main className="page-with-bottom-nav mx-auto max-w-lg px-4 py-12 text-center text-gray-400">
          <p className="mb-3 text-4xl">😕</p>
          <p>트렌드를 찾을 수 없어요.</p>
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Header showBack />
      <main className="page-with-bottom-nav mx-auto max-w-lg space-y-4 px-4 py-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">{initialTrend.name}</h2>
            <TrendBadge status={initialTrend.status} />
          </div>
          <p className="text-sm text-gray-500">
            {initialTrend.description ||
              "이 트렌드는 최근 감지되어 상세 정보를 정리 중입니다. 판매처를 알고 있다면 제보를 통해 보강할 수 있습니다."}
          </p>
          {initialTrend.search_volume_data &&
          Object.keys(initialTrend.search_volume_data).length > 0 ? (
            <VolumeChart data={initialTrend.search_volume_data} />
          ) : null}
          <p className="mb-3 mt-1 text-xs text-gray-400">
            {initialTrend.detected_at
              ? `${new Date(initialTrend.detected_at).toLocaleDateString("ko-KR")} 감지`
              : "최근 감지"}{" "}
            · 판매처 {sortedStores.length}곳
          </p>
          <ShareButton
            title={`${initialTrend.name} - 요즘뭐먹`}
            description={initialTrend.description ?? undefined}
            imageUrl={initialTrend.image_url ?? undefined}
          />
        </div>

        {editorialNotes ? (
          <article className="space-y-4">
            <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="text-lg font-bold text-gray-900">이 트렌드 한눈에 보기</h3>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-primary/5 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    상태
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {initialTrend.status}
                  </p>
                </div>
                <div className="rounded-2xl bg-primary/5 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    감지일
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {detectedLabel}
                  </p>
                </div>
                <div className="rounded-2xl bg-primary/5 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    판매처
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {sortedStores.length}곳
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="text-lg font-bold text-gray-900">왜 주목하나</h3>
              <div className="mt-3 space-y-3 text-sm leading-7 text-gray-600">
                {editorialNotes.overview.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
              <h3 className="text-lg font-bold text-gray-900">이 페이지를 읽는 방법</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-gray-600">
                {editorialNotes.usage.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-gray-900">운영 메모</h3>
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-primary">
                  <Link href="/how-it-works">수집 방식</Link>
                  <Link href="/editorial-policy">운영 원칙</Link>
                  <Link href="/data-sources">데이터 출처</Link>
                </div>
              </div>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-gray-600">
                {editorialNotes.operations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </article>
        ) : null}

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

        {locationMessage ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900">{locationMessage}</p>
            {canRetryLocation ? (
              <button
                type="button"
                onClick={() => {
                  void requestLocation();
                }}
                className="mt-3 rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-950"
              >
                현재 위치 다시 시도
              </button>
            ) : null}
          </div>
        ) : null}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">판매처 목록</h3>
            <Link
              href={withAppClipParam(`/report?trend=${id}`, isAppClipExperience)}
              className="text-xs font-medium text-primary"
            >
              + 제보하기
            </Link>
          </div>
          {initialStores.length > 3 ? (
            <div className="mb-3">
              <input
                type="text"
                value={storeQuery}
                onChange={(event) => setStoreQuery(event.target.value)}
                placeholder="판매처 이름이나 주소 검색"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          ) : null}
          <StoreList
            stores={sortedStores}
            userLoc={userLoc}
            selectedStoreId={selectedStoreId}
            onStoreClick={setSelectedStoreId}
          />
        </div>

        <AdSlot slot={ADSENSE_TREND_DETAIL_SLOT} />
      </main>
      <BottomNav />
      <ScrollToTop />
    </>
  );
}
