"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  YomechuCategorySlug,
  YomechuFeedbackRow,
  YomechuPlaceRow,
  YomechuSpinRow,
} from "@/lib/types";

const PAGE_SIZE = 1000;
const RECENT_DAYS = 7;

type CategoryFilter = "any" | YomechuCategorySlug;

interface SectionState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

const CATEGORY_LABELS: Record<YomechuCategorySlug, string> = {
  all: "전체",
  korean: "한식",
  chinese: "중식",
  japanese: "일식",
  western: "양식",
  snack: "분식",
  chicken: "치킨",
  pizza: "피자",
  asian: "아시안",
  "cafe-dessert": "카페/디저트",
  pub: "주점",
};

const FEEDBACK_LABELS: Record<YomechuFeedbackRow["event_type"], string> = {
  open: "매장 열기",
  reroll: "다시 추천",
  close: "모달 닫기",
  share: "결과 공유",
};

function createEmptySectionState<T>(data: T): SectionState<T> {
  return {
    data,
    loading: true,
    error: null,
  };
}

function getRecentCutoff() {
  return new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
}

function isRecentDate(value: string, cutoff: Date) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed >= cutoff;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "없음";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "없음";
  }

  return parsed.toLocaleString("ko-KR");
}

function formatRatio(value: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  return `${((value / total) * 100).toFixed(1)}%`;
}

function formatNumberValue(value: number | null, digits = 1) {
  if (value === null || value === undefined) {
    return "-";
  }

  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return "-";
  }

  return numericValue.toFixed(digits);
}

async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>
) {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const result = await fetchPage(from, to);

    if (result.error) {
      throw new Error(result.error.message || "데이터를 불러오지 못했습니다.");
    }

    const batch = result.data ?? [];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

function SectionStatus({
  message,
  tone = "muted",
}: {
  message: string;
  tone?: "muted" | "error";
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
      <p className={tone === "error" ? "text-sm text-red-500" : "text-sm text-gray-400"}>
        {message}
      </p>
    </div>
  );
}

export default function YomechuTab() {
  const [placesState, setPlacesState] = useState<SectionState<YomechuPlaceRow[]>>(
    createEmptySectionState([])
  );
  const [spinsState, setSpinsState] = useState<SectionState<YomechuSpinRow[]>>(
    createEmptySectionState([])
  );
  const [feedbackState, setFeedbackState] = useState<SectionState<YomechuFeedbackRow[]>>(
    createEmptySectionState([])
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("any");
  const [showMissingRatingOnly, setShowMissingRatingOnly] = useState(false);
  const [showMissingTrendOnly, setShowMissingTrendOnly] = useState(false);
  const [showRecentOnly, setShowRecentOnly] = useState(false);

  const loadData = async () => {
    const cutoffIso = getRecentCutoff().toISOString();

    setPlacesState((current) => ({ ...current, loading: true, error: null }));
    setSpinsState((current) => ({ ...current, loading: true, error: null }));
    setFeedbackState((current) => ({ ...current, loading: true, error: null }));

    const [placesResult, spinsResult, feedbackResult] = await Promise.allSettled([
      fetchAllPages<YomechuPlaceRow>((from, to) =>
        supabase
          .from("yomechu_places")
          .select("*")
          .order("last_seen_at", { ascending: false })
          .range(from, to)
      ),
      fetchAllPages<YomechuSpinRow>((from, to) =>
        supabase
          .from("yomechu_spins")
          .select("*")
          .gte("created_at", cutoffIso)
          .order("created_at", { ascending: false })
          .range(from, to)
      ),
      fetchAllPages<YomechuFeedbackRow>((from, to) =>
        supabase
          .from("yomechu_feedback")
          .select("*")
          .gte("created_at", cutoffIso)
          .order("created_at", { ascending: false })
          .range(from, to)
      ),
    ]);

    setPlacesState({
      data: placesResult.status === "fulfilled" ? placesResult.value : [],
      loading: false,
      error:
        placesResult.status === "rejected"
          ? placesResult.reason instanceof Error
            ? placesResult.reason.message
            : "요메추 후보 목록을 불러오지 못했습니다."
          : null,
    });
    setSpinsState({
      data: spinsResult.status === "fulfilled" ? spinsResult.value : [],
      loading: false,
      error:
        spinsResult.status === "rejected"
          ? spinsResult.reason instanceof Error
            ? spinsResult.reason.message
            : "요메추 최근 추천 기록을 불러오지 못했습니다."
          : null,
    });
    setFeedbackState({
      data: feedbackResult.status === "fulfilled" ? feedbackResult.value : [],
      loading: false,
      error:
        feedbackResult.status === "rejected"
          ? feedbackResult.reason instanceof Error
            ? feedbackResult.reason.message
            : "요메추 피드백 요약을 불러오지 못했습니다."
          : null,
    });
  };

  useEffect(() => {
    void loadData();
  }, []);

  const recentCutoff = getRecentCutoff();
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const placeNameById = new Map(placesState.data.map((place) => [place.id, place.name]));
  const totalPlaces = placesState.data.length;
  const ratedPlaces = placesState.data.filter((place) => place.rating !== null).length;
  const linkedPlaces = placesState.data.filter((place) => place.trend_names.length > 0).length;
  const recentPlaces = placesState.data.filter((place) =>
    isRecentDate(place.last_seen_at, recentCutoff)
  ).length;

  const filteredPlaces = placesState.data.filter((place) => {
    if (categoryFilter !== "any" && place.category_slug !== categoryFilter) {
      return false;
    }

    if (showMissingRatingOnly && place.rating !== null) {
      return false;
    }

    if (showMissingTrendOnly && place.trend_names.length > 0) {
      return false;
    }

    if (showRecentOnly && !isRecentDate(place.last_seen_at, recentCutoff)) {
      return false;
    }

    if (!normalizedSearchQuery) {
      return true;
    }

    const haystack = [
      place.name,
      place.address,
      ...place.trend_names,
      CATEGORY_LABELS[place.category_slug] || place.category_name,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearchQuery);
  });

  const feedbackCounts = feedbackState.data.reduce(
    (counts, feedback) => {
      counts[feedback.event_type] += 1;
      return counts;
    },
    { open: 0, reroll: 0, close: 0, share: 0 } satisfies Record<
      YomechuFeedbackRow["event_type"],
      number
    >
  );
  const recentSpins = spinsState.data.slice(0, 15);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">요메추 운영</h2>
          <p className="text-sm text-gray-400 mt-1">
            추천 후보 품질과 최근 7일 사용 흐름을 한 화면에서 점검합니다.
          </p>
        </div>
        <button
          onClick={() => {
            void loadData();
          }}
          className="px-4 py-2 bg-white border border-gray-200 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
        >
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-400 mb-1">전체 후보 수</p>
          <p className="text-2xl font-bold text-gray-900">
            {placesState.loading ? "-" : totalPlaces.toLocaleString("ko-KR")}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {placesState.error ? "후보 데이터를 확인하세요" : "요메추 후보 풀 전체"}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-400 mb-1">평점 보강 완료</p>
          <p className="text-2xl font-bold text-gray-900">
            {placesState.loading ? "-" : ratedPlaces.toLocaleString("ko-KR")}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {placesState.loading ? "-" : `${formatRatio(ratedPlaces, totalPlaces)} 완료`}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-400 mb-1">트렌드 연결 후보</p>
          <p className="text-2xl font-bold text-gray-900">
            {placesState.loading ? "-" : linkedPlaces.toLocaleString("ko-KR")}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {placesState.loading ? "-" : `${formatRatio(linkedPlaces, totalPlaces)} 연결`}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-400 mb-1">최근 7일 재노출 후보</p>
          <p className="text-2xl font-bold text-gray-900">
            {placesState.loading ? "-" : recentPlaces.toLocaleString("ko-KR")}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {placesState.loading ? "-" : `${formatRatio(recentPlaces, totalPlaces)} 최근 관측`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-gray-900">추천 후보 품질 점검</h3>
                <p className="text-xs text-gray-400">
                  매장명, 주소, 연결 트렌드로 검색하고 품질 이슈가 있는 후보만 좁혀볼 수 있습니다.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="매장명, 주소, 트렌드명으로 검색"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    <option value="any">전체 카테고리</option>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showMissingRatingOnly}
                        onChange={(event) => setShowMissingRatingOnly(event.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-purple-300"
                      />
                      평점 없음
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showMissingTrendOnly}
                        onChange={(event) => setShowMissingTrendOnly(event.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-purple-300"
                      />
                      트렌드 연결 없음
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showRecentOnly}
                        onChange={(event) => setShowRecentOnly(event.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-purple-300"
                      />
                      최근 7일만
                    </label>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  {placesState.loading
                    ? "후보 목록을 불러오는 중입니다."
                    : `필터 결과 ${filteredPlaces.length.toLocaleString("ko-KR")}건 / 전체 ${totalPlaces.toLocaleString("ko-KR")}건`}
                </p>
              </div>
            </div>
          </div>

          {placesState.loading ? (
            <SectionStatus message="요메추 후보 목록을 불러오는 중입니다." />
          ) : placesState.error ? (
            <SectionStatus message={placesState.error} tone="error" />
          ) : filteredPlaces.length === 0 ? (
            <SectionStatus message="조건에 맞는 요메추 후보가 없습니다." />
          ) : (
            <div className="flex flex-col gap-3">
              {filteredPlaces.map((place) => (
                <div key={place.id} className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-600">
                          {CATEGORY_LABELS[place.category_slug] || place.category_name}
                        </span>
                        {place.rating === null ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
                            평점 없음
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-700">
                            평점 {formatNumberValue(place.rating, 1)}
                          </span>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                          품질 점수 {formatNumberValue(place.quality_score, 2)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="font-semibold text-gray-900">{place.name}</h3>
                        <p className="text-sm text-gray-500">{place.address}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {place.trend_names.length > 0 ? (
                          place.trend_names.map((trendName) => (
                            <span
                              key={`${place.id}-${trendName}`}
                              className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600"
                            >
                              {trendName}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                            연결된 트렌드 없음
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 mt-3 text-xs text-gray-400">
                        <p>최근 관측: {formatDateTime(place.last_seen_at)}</p>
                        <p>최근 평점 보강: {formatDateTime(place.last_enriched_at)}</p>
                      </div>
                    </div>
                    {place.place_url && (
                      <a
                        href={place.place_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors flex-shrink-0"
                      >
                        장소 링크
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex flex-col gap-1 mb-4">
              <h3 className="text-sm font-semibold text-gray-900">최근 추천 기록</h3>
              <p className="text-xs text-gray-400">최근 7일 스핀 중 최신 15건을 보여줍니다.</p>
            </div>
            {spinsState.loading ? (
              <SectionStatus message="최근 추천 기록을 불러오는 중입니다." />
            ) : spinsState.error ? (
              <SectionStatus message={spinsState.error} tone="error" />
            ) : recentSpins.length === 0 ? (
              <SectionStatus message="최근 7일 추천 기록이 없습니다." />
            ) : (
              <div className="flex flex-col gap-3">
                {recentSpins.map((spin) => (
                  <div key={spin.id} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-600">
                        {CATEGORY_LABELS[spin.category_slug] || spin.category_slug}
                      </span>
                      {spin.used_fallback && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
                          fallback 사용
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 text-sm text-gray-700">
                      <p className="font-medium text-gray-900">
                        당첨 매장:{" "}
                        {spin.winner_place_id
                          ? placeNameById.get(spin.winner_place_id) || "매장명을 찾지 못했습니다."
                          : "기록 없음"}
                      </p>
                      <p>
                        반경 {spin.radius_m.toLocaleString("ko-KR")}m · 후보 풀 {spin.pool_size}곳
                      </p>
                      <p className="text-xs text-gray-400">{formatDateTime(spin.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex flex-col gap-1 mb-4">
              <h3 className="text-sm font-semibold text-gray-900">최근 7일 피드백 요약</h3>
              <p className="text-xs text-gray-400">
                최근 7일 스핀 {spinsState.data.length.toLocaleString("ko-KR")}건 대비 반응 비율입니다.
              </p>
            </div>
            {feedbackState.loading ? (
              <SectionStatus message="최근 피드백을 집계하는 중입니다." />
            ) : feedbackState.error ? (
              <SectionStatus message={feedbackState.error} tone="error" />
            ) : (
              <div className="flex flex-col gap-3">
                {(Object.keys(FEEDBACK_LABELS) as YomechuFeedbackRow["event_type"][]).map(
                  (eventType) => (
                    <div
                      key={eventType}
                      className="rounded-xl border border-gray-100 p-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {FEEDBACK_LABELS[eventType]}
                        </p>
                        <p className="text-xs text-gray-400">
                          최근 7일 {feedbackCounts[eventType].toLocaleString("ko-KR")}건
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-primary">
                        {formatRatio(feedbackCounts[eventType], spinsState.data.length)}
                      </span>
                    </div>
                  )
                )}
                {feedbackState.data.length === 0 && (
                  <p className="text-xs text-gray-400">
                    최근 7일에 기록된 피드백이 없어 모든 이벤트가 0건으로 표시됩니다.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
