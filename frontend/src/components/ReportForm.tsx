"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { submitStoreReport } from "@/lib/crawler";
import { supabase } from "@/lib/supabase";
import type { Trend } from "@/lib/types";

interface PlaceResult {
  place_name: string;
  road_address_name: string;
  address_name: string;
  x: string;
  y: string;
  phone: string;
}

function ensureKakaoLoaded(): Promise<void> {
  return new Promise((resolve) => {
    if (window.kakao?.maps?.services) {
      resolve();
      return;
    }
    if (window.kakao?.maps) {
      kakao.maps.load(() => resolve());
    } else {
      resolve();
    }
  });
}

interface ReportFormProps {
  initialTrends: Trend[];
}

interface ReportFieldProps {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}

function ReportField({ label, children, hint }: ReportFieldProps) {
  return (
    <div className="mb-3.5 last:mb-0">
      <div className="mb-1.5 text-[10.5px] font-bold tracking-[-0.01em] text-ink4">
        {label}
      </div>
      {children}
      {hint ? <div className="mt-1.5">{hint}</div> : null}
    </div>
  );
}

const fieldInputClass =
  "block w-full rounded-[10px] border border-line bg-bg px-3.5 py-3 text-[13.5px] text-ink outline-none transition-colors focus:border-accent focus:bg-surface disabled:cursor-not-allowed disabled:text-ink4";

export default function ReportForm({ initialTrends }: ReportFormProps) {
  const [trends, setTrends] = useState<Trend[]>(initialTrends);
  const [trendId, setTrendId] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [selected, setSelected] = useState<PlaceResult | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedStoreName, setSubmittedStoreName] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(initialTrends.length === 0);
  const [trendsError, setTrendsError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const paginationRef = useRef<kakao.maps.services.PlacesPagination | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchTrends = useCallback(async () => {
    setTrendsLoading(true);
    setTrendsError(null);

    const { data, error } = await supabase
      .from("trends")
      .select("id, name, category, status")
      .in("status", ["rising", "active", "declining"])
      .order("peak_score", { ascending: false })
      .order("id", { ascending: true });

    if (error) {
      setTrendsError("트렌드 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setTrendsLoading(false);
      return;
    }

    setTrends((data as Trend[]) ?? []);
    setTrendsLoading(false);
  }, []);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const isFirstSearchRef = useRef(true);

  const startSearch = useCallback(async (keyword: string) => {
    await ensureKakaoLoaded();
    if (!window.kakao?.maps?.services) return;

    isFirstSearchRef.current = true;
    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(
      keyword,
      (result, status, pagination) => {
        if (status === kakao.maps.services.Status.OK) {
          if (isFirstSearchRef.current) {
            setResults(result as PlaceResult[]);
            isFirstSearchRef.current = false;
          } else {
            setResults((prev) => [...prev, ...(result as PlaceResult[])]);
          }
          paginationRef.current = pagination;
          setShowResults(true);
        }
        setLoadingMore(false);
      },
      { size: 15 }
    );
  }, []);

  useEffect(() => {
    if (selected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 2) {
      setResults([]);
      paginationRef.current = null;
      return;
    }
    debounceRef.current = setTimeout(() => startSearch(query), 300);
  }, [query, selected, startSearch]);

  const handleDropdownScroll = useCallback(() => {
    const el = dropdownRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
      const pg = paginationRef.current;
      if (pg && pg.hasNextPage && !loadingMore) {
        setLoadingMore(true);
        pg.nextPage();
      }
    }
  }, [loadingMore]);

  const handleSelect = (place: PlaceResult) => {
    setSelected(place);
    setQuery(place.place_name);
    setResults([]);
    setShowResults(false);
    paginationRef.current = null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trendId || !selected) return;

    setSubmitting(true);
    setSubmitError(null);

    const address = selected.road_address_name || selected.address_name;
    const trendName = trends.find((t) => t.id === trendId)?.name ?? "";
    const storeName = selected.place_name;

    try {
      const response = await submitStoreReport({
        trend_id: trendId,
        store_name: storeName,
        address,
        lat: Number.parseFloat(selected.y),
        lng: Number.parseFloat(selected.x),
        note: note || null,
      });
      const data = response.data;

      if (data?.[0]?.id) {
        const entry = {
          id: data[0].id,
          store_name: storeName,
          trend_name: trendName,
          status: "pending",
          created_at: new Date().toISOString(),
        };
        const prev = JSON.parse(localStorage.getItem("my_reports") ?? "[]");
        localStorage.setItem(
          "my_reports",
          JSON.stringify([entry, ...prev].slice(0, 20))
        );
      }

      setSubmittedStoreName(storeName);
      setSubmitted(true);
      setQuery("");
      setSelected(null);
      setNote("");
      setTrendId("");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "제보 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    !submitting &&
    !!selected &&
    !!trendId &&
    !trendsLoading &&
    !trendsError &&
    trends.length > 0;

  if (submitted) {
    return (
      <div
        className="rounded-[20px] border bg-accent-soft px-6 py-7 text-center"
        style={{ borderColor: "rgba(107,79,211,0.25)" }}
      >
        <div className="font-kicker text-[10px] font-bold text-accent">SUBMITTED</div>
        <div className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] text-ink">
          제보가 접수되었어요
        </div>
        <div className="mt-2 text-[12.5px] leading-[1.55] tracking-[-0.01em] text-ink3">
          <span className="font-semibold text-ink2">&apos;{submittedStoreName}&apos;</span> 확인 후 지도에 반영해드릴게요.
          <br />
          보통 24시간 이내에 반영됩니다.
        </div>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-4 inline-flex items-center justify-center rounded-[10px] bg-ink px-5 py-2.5 text-[12.5px] font-bold tracking-[-0.01em] text-surface"
        >
          다른 제보하기
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[20px] border border-line bg-surface p-[18px]"
    >
      <ReportField
        label="관련 트렌드"
        hint={
          trendsLoading ? (
            <p className="text-[11px] text-ink4">트렌드 목록 불러오는 중...</p>
          ) : trendsError ? (
            <div className="flex items-center justify-between gap-3 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-[11px] text-red-700">{trendsError}</p>
              <button
                type="button"
                onClick={fetchTrends}
                className="shrink-0 rounded-[8px] bg-red-700 px-2.5 py-1 text-[11px] font-semibold text-white"
              >
                다시 시도
              </button>
            </div>
          ) : trends.length === 0 ? (
            <p className="text-[11px] text-ink4">현재 제보 가능한 활성 트렌드가 없습니다.</p>
          ) : null
        }
      >
        <div className="relative">
          <select
            value={trendId}
            onChange={(e) => setTrendId(e.target.value)}
            className={`${fieldInputClass} appearance-none pr-9`}
            disabled={trendsLoading || !!trendsError || trends.length === 0}
            required
          >
            <option value="">
              {trendsLoading
                ? "트렌드 불러오는 중..."
                : trendsError
                  ? "트렌드 로드 실패"
                  : trends.length === 0
                    ? "등록된 트렌드 없음"
                    : "선택하세요"}
            </option>
            {trends.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink4"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </ReportField>

      <ReportField label="판매처 이름">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selected) setSelected(null);
            }}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="매장 이름을 검색하세요 (예: 성수 베이글)"
            className={fieldInputClass}
            required
          />

          {showResults && results.length > 0 && (
            <div
              ref={dropdownRef}
              onScroll={handleDropdownScroll}
              className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-[12px] border border-line bg-surface shadow-[0_12px_28px_rgba(20,18,26,0.12)]"
            >
              {results.map((place, i) => {
                const addr = place.road_address_name || place.address_name;
                const region = addr.split(" ").slice(0, 2).join(" ");
                return (
                  <button
                    key={`${place.place_name}-${place.x}-${i}`}
                    type="button"
                    onClick={() => handleSelect(place)}
                    className="w-full border-b border-line2 px-3.5 py-2.5 text-left transition-colors last:border-0 hover:bg-accent-soft"
                  >
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-semibold text-ink">
                        {place.place_name}
                      </p>
                      <span className="shrink-0 rounded bg-line2 px-1.5 py-[1px] text-[10px] text-ink4">
                        {region}
                      </span>
                    </div>
                    <p className="truncate text-[11.5px] text-ink4">{addr}</p>
                  </button>
                );
              })}
              {loadingMore && (
                <div className="px-4 py-3 text-center text-[11px] text-ink4">
                  검색 중...
                </div>
              )}
            </div>
          )}
        </div>

        {selected && (
          <div className="mt-2 flex items-center justify-between rounded-[10px] border border-accent/25 bg-accent-soft px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-accent-ink">
                {selected.place_name}
              </p>
              <p className="truncate text-[11.5px] text-ink3">
                {selected.road_address_name || selected.address_name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setQuery("");
              }}
              className="shrink-0 rounded-[8px] bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink2"
            >
              변경
            </button>
          </div>
        )}
      </ReportField>

      <ReportField label="메모 (선택)">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="영업시간, 메뉴 이름 등"
          rows={3}
          className={`${fieldInputClass} resize-none`}
        />
      </ReportField>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-4 w-full rounded-[12px] bg-ink px-4 py-4 text-[14px] font-extrabold tracking-[-0.02em] text-surface transition-opacity disabled:opacity-40"
      >
        {submitting ? "제보 중..." : "제보하기"}
      </button>

      {submitError && (
        <p className="mt-3 text-[12px] text-neg">{submitError}</p>
      )}
    </form>
  );
}
