"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

import NewProductCard from "@/components/NewProductCard";
import {
  deriveNewProductsView,
  type NewProductBrandOption,
  type NewProductCategoryOption,
  type NewProductListItem,
  type NewProductSourceFilter,
  type NewProductsPeriod,
  type NewProductsViewData,
} from "@/lib/new-products";
import type {
  NewProductSectorFilter,
  NewProductSectorKey,
} from "@/lib/new-product-taxonomy";

import {
  PERIOD_OPTIONS,
  SECTOR_OPTIONS,
  SOURCE_OPTIONS,
  buildFilterHref,
  getPeriodLabel,
  getSectorLabel,
} from "./filters";

const PAGE_SIZE = 12;

type DropdownKey = "period";
type CatalogStatus = "idle" | "loading" | "ready" | "failed";
type FilterMode = "server" | "client";
type CatalogResponse = {
  products: NewProductListItem[];
  lastUpdated: string | null;
};

interface NewProductsClientProps {
  initialProducts: NewProductListItem[];
  initialSectorCounts: Record<NewProductSectorKey, number>;
  initialCategoryOptions: NewProductCategoryOption[];
  initialBrandOptions: NewProductBrandOption[];
  initialBrandCount: number;
  initialTotalCount: number;
  initialLastUpdated: string | null;
  initialSource: NewProductSourceFilter;
  initialPeriod: NewProductsPeriod;
  initialSector: NewProductSectorFilter;
  initialCategory: string;
  initialBrand: string | null;
}

interface FilterDropdownProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ key: T; label: string }>;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (next: T) => void;
}

interface FilterState {
  source: NewProductSourceFilter;
  period: NewProductsPeriod;
  sector: NewProductSectorFilter;
  category: string;
  brand: string | null;
}

type IdleCapableWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (callback: () => void) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

const catalogRequestPromises = new Map<NewProductSourceFilter, Promise<CatalogResponse>>();
const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});

function fetchNewProductsCatalog(source: NewProductSourceFilter) {
  const existingRequest = catalogRequestPromises.get(source);
  if (existingRequest) {
    return existingRequest;
  }

  const request = fetch(`/api/new-products/catalog?source=${source}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch new products catalog.");
        }

        return (await response.json()) as CatalogResponse;
      })
      .catch((error) => {
        catalogRequestPromises.delete(source);
        throw error;
      });

  catalogRequestPromises.set(source, request);
  return request;
}

function scheduleIdleTask(callback: () => void) {
  const idleWindow = window as IdleCapableWindow;

  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(callback);
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const timeoutId = window.setTimeout(callback, 0);
  return () => window.clearTimeout(timeoutId);
}

function formatUpdatedAt(value: string | null) {
  if (!value) {
    return "방금";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "방금";
  }

  const parts = UPDATED_AT_FORMATTER.formatToParts(parsed);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const month = getPart("month");
  const day = getPart("day");
  const hour = Number(getPart("hour"));
  const minute = getPart("minute");

  if (!month || !day || !minute || Number.isNaN(hour)) {
    return "방금";
  }

  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 || 12;
  return `${month}월 ${day}일 ${period} ${displayHour}:${minute}`;
}

function ChevronDown() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilterDropdown<T extends string>({
  label,
  value,
  options,
  open,
  onOpen,
  onClose,
  onSelect,
}: FilterDropdownProps<T>) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const current =
    options.find((option) => option.key === value)?.label ?? options[0]?.label;

  return (
    <div className="flex-1">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <div ref={wrapperRef} className="relative mt-1.5">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => (open ? onClose() : onOpen())}
          className="flex w-full items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 ring-1 ring-gray-200 transition-colors hover:ring-primary"
        >
          <span>{current}</span>
          <ChevronDown />
        </button>

        {open && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-gray-100"
          >
            {options.map((option) => {
              const active = option.key === value;
              return (
                <li
                  key={option.key}
                  role="option"
                  aria-selected={active}
                  onClick={() => onSelect(option.key)}
                  className={`cursor-pointer px-3.5 py-2 text-sm transition-colors ${
                    active
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {option.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function NewProductsClient({
  initialProducts,
  initialSectorCounts,
  initialCategoryOptions,
  initialBrandOptions,
  initialBrandCount,
  initialTotalCount,
  initialLastUpdated,
  initialSource,
  initialPeriod,
  initialSector,
  initialCategory,
  initialBrand,
}: NewProductsClientProps) {
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const initialView = useMemo<NewProductsViewData>(
    () => ({
      products: initialProducts,
      sectorCounts: initialSectorCounts,
      categoryOptions: initialCategoryOptions,
      brandOptions: initialBrandOptions,
      brandCount: initialBrandCount,
      totalCount: initialTotalCount,
      selectedCategory: initialCategory === "all" ? null : initialCategory,
      selectedBrand: initialBrand,
    }),
    [
      initialProducts,
      initialSectorCounts,
      initialCategoryOptions,
      initialBrandOptions,
      initialBrandCount,
      initialTotalCount,
      initialCategory,
      initialBrand,
    ]
  );

  const [filters, setFilters] = useState<FilterState>({
    source: initialSource,
    period: initialPeriod,
    sector: initialSector,
    category: initialCategory,
    brand: initialBrand,
  });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("idle");
  const [filterMode, setFilterMode] = useState<FilterMode>("server");
  const [catalogDataBySource, setCatalogDataBySource] = useState<
    Partial<Record<NewProductSourceFilter, CatalogResponse>>
  >({});

  useEffect(() => {
    setFilters({
      source: initialSource,
      period: initialPeriod,
      sector: initialSector,
      category: initialCategory,
      brand: initialBrand,
    });
    setFilterMode("server");
  }, [
    initialSource,
    initialPeriod,
    initialSector,
    initialCategory,
    initialBrand,
    initialTotalCount,
  ]);

  useEffect(() => {
    let cancelled = false;

    setCatalogStatus((current) => (current === "ready" ? current : "loading"));

    const cancelScheduledTask = scheduleIdleTask(() => {
      void fetchNewProductsCatalog(initialSource)
        .then((data) => {
          if (cancelled) {
            return;
          }

          setCatalogDataBySource((current) => ({
            ...current,
            [initialSource]: data,
          }));
          setCatalogStatus("ready");
        })
        .catch(() => {
          if (cancelled) {
            return;
          }

          setCatalogStatus("failed");
        });
    });

    return () => {
      cancelled = true;
      cancelScheduledTask();
    };
  }, [initialSource]);

  const clientView = useMemo(() => {
    const catalogData = catalogDataBySource[filters.source];
    if (filterMode !== "client" || !catalogData) {
      return null;
    }

    return deriveNewProductsView(catalogData.products, filters);
  }, [catalogDataBySource, filterMode, filters]);

  const currentView = clientView ?? initialView;
  const currentSource = filterMode === "client" ? filters.source : initialSource;
  const currentPeriod = filterMode === "client" ? filters.period : initialPeriod;
  const currentSector =
    currentSource === "convenience"
      ? "all"
      : filterMode === "client"
        ? filters.sector
        : initialSector;
  const currentCategory =
    currentSource === "convenience"
      ? currentView.selectedCategory ?? "all"
      : "all";
  const currentBrand = currentView.selectedBrand;
  const currentCatalogData = catalogDataBySource[currentSource];
  const currentLastUpdated =
    filterMode === "client"
      ? currentCatalogData?.lastUpdated ?? initialLastUpdated
      : initialLastUpdated;
  const totalSectorCount = useMemo(
    () => Object.values(currentView.sectorCounts).reduce((sum, value) => sum + value, 0),
    [currentView.sectorCounts]
  );
  const visibleProducts = useMemo(
    () => currentView.products.slice(0, visibleCount),
    [currentView.products, visibleCount]
  );
  const sectorSummary = useMemo(
    () =>
      SECTOR_OPTIONS.filter(
        (
          option
        ): option is {
          key: NewProductSectorKey;
          label: string;
        } => option.key !== "all" && currentView.sectorCounts[option.key] > 0
      ),
    [currentView.sectorCounts]
  );
  const visibleSectorHighlights = sectorSummary.slice(0, 3);
  const totalCategoryCount = currentView.categoryOptions.reduce(
    (sum, option) => sum + option.count,
    0
  );
  const selectedBrandLabel =
    currentView.brandOptions.find((option) => option.key === currentBrand)?.label ??
    currentBrand;
  const hasMore = visibleCount < currentView.products.length;
  const isConvenience = currentSource === "convenience";

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [
    currentSource,
    currentPeriod,
    currentSector,
    currentCategory,
    currentBrand,
    filterMode,
  ]);

  useEffect(() => {
    if (!hasMore) return;

    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((current) =>
            Math.min(current + PAGE_SIZE, currentView.products.length)
          );
        }
      },
      { rootMargin: "400px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [currentView.products.length, hasMore]);

  const applyFilter = (
    nextPeriod: NewProductsPeriod,
    nextSector: NewProductSectorFilter,
    nextBrand: string | null = currentBrand,
    nextSource: NewProductSourceFilter = currentSource,
    nextCategory = currentCategory
  ) => {
    const normalizedSector = nextSource === "convenience" ? "all" : nextSector;
    const normalizedCategory = nextSource === "convenience" ? nextCategory : "all";
    const requestedFilters: FilterState = {
      source: nextSource,
      period: nextPeriod,
      sector: normalizedSector,
      category: normalizedCategory,
      brand:
        (nextSource === "convenience" && normalizedCategory !== "all") ||
        (nextSource === "franchise" && normalizedSector !== "all")
          ? nextBrand
          : null,
    };

    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    setOpenDropdown(null);

    const catalogData = catalogDataBySource[requestedFilters.source];
    if (catalogStatus !== "ready" || !catalogData) {
      router.replace(
        buildFilterHref(
          requestedFilters.source,
          requestedFilters.period,
          requestedFilters.sector,
          requestedFilters.brand,
          requestedFilters.category
        ),
        { scroll: false }
      );
      return;
    }

    const nextView = deriveNewProductsView(catalogData.products, requestedFilters);
    const nextFilters: FilterState = {
      ...requestedFilters,
      category:
        requestedFilters.source === "convenience"
          ? nextView.selectedCategory ?? "all"
          : "all",
      brand: nextView.selectedBrand,
    };

    startTransition(() => {
      setFilterMode("client");
      setFilters(nextFilters);
    });

    window.history.replaceState(
      {},
      "",
      buildFilterHref(
        nextFilters.source,
        nextFilters.period,
        nextFilters.sector,
        nextFilters.brand,
        nextFilters.category
      )
    );
  };

  return (
    <>
      <section className="mb-4">
        <div className="font-kicker text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
          New Arrivals
        </div>
        <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.03em] text-ink">
          신상
        </h1>
        <p className="mt-1 text-[12.5px] tracking-[-0.01em] text-ink4">
          프랜차이즈·편의점 신메뉴를 매일 업데이트
        </p>
      </section>

      <section className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-line2 p-1">
        {SOURCE_OPTIONS.map((option) => {
          const active = currentSource === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() =>
                applyFilter(currentPeriod, "all", null, option.key, "all")
              }
              className={`rounded-full px-3 py-2 text-[12.5px] font-bold tracking-[-0.01em] transition-colors ${
                active
                  ? "bg-ink text-surface"
                  : "text-ink3 hover:bg-surface"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </section>

      <section className="mb-4 flex flex-wrap gap-1.5">
        {PERIOD_OPTIONS.map((option) => {
          const active = currentPeriod === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() =>
                applyFilter(
                  option.key,
                  isConvenience ? "all" : currentSector,
                  currentBrand,
                  currentSource,
                  isConvenience ? currentCategory : "all"
                )
              }
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-semibold tracking-[-0.01em] transition-colors ${
                active
                  ? "bg-ink text-surface"
                  : "bg-surface text-ink2 ring-1 ring-inset ring-line"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </section>

      <section className="mb-4 rounded-[20px] border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-bold text-ink3">
            {isConvenience ? "카테고리" : "업종"}
          </p>
          <span className="text-[11px] text-ink4">
            {currentView.totalCount}개 · 브랜드 {currentView.brandCount}곳
          </span>
        </div>
        {isConvenience ? (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyFilter(currentPeriod, "all", null, currentSource, "all")}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                currentCategory === "all"
                  ? "bg-accent text-surface"
                  : "bg-accent-soft text-accent hover:bg-accent/20"
              }`}
            >
              전체 {totalCategoryCount}
            </button>
            {currentView.categoryOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() =>
                  applyFilter(currentPeriod, "all", null, currentSource, option.key)
                }
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  currentCategory === option.key
                    ? "bg-accent text-surface"
                    : "bg-accent-soft text-accent hover:bg-accent/20"
                }`}
              >
                {option.label} {option.count}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {SECTOR_OPTIONS.map((option) => {
              const active = currentSector === option.key;
              const count =
                option.key === "all"
                  ? totalSectorCount
                  : currentView.sectorCounts[option.key];
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => applyFilter(currentPeriod, option.key, null)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-accent text-surface"
                      : "bg-accent-soft text-accent hover:bg-accent/20"
                  }`}
                >
                  {option.label} {count}
                </button>
              );
            })}
          </div>
        )}

        {((isConvenience && currentCategory !== "all") ||
          (!isConvenience && currentSector !== "all")) &&
        currentView.brandOptions.length > 0 ? (
          <>
            <p className="mt-4 mb-2 text-[11px] font-bold text-ink3">
              브랜드
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() =>
                  applyFilter(
                    currentPeriod,
                    currentSector,
                    null,
                    currentSource,
                    currentCategory
                  )
                }
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  !currentBrand
                    ? "bg-ink text-surface"
                    : "bg-line2 text-ink3 hover:bg-line"
                }`}
              >
                전체 브랜드
              </button>
              {currentView.brandOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() =>
                    applyFilter(
                      currentPeriod,
                      currentSector,
                      option.key,
                      currentSource,
                      currentCategory
                    )
                  }
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    currentBrand === option.key
                      ? "bg-ink text-surface"
                      : "bg-line2 text-ink3 hover:bg-line"
                  }`}
                >
                  {option.label} {option.count}
                </button>
              ))}
            </div>
          </>
        ) : null}

        <p className="mt-3 text-[11px] text-ink4">
          마지막 수집: {formatUpdatedAt(currentLastUpdated)}
        </p>
      </section>

      <section className="mb-6">
        {currentView.products.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-line bg-surface px-5 py-12 text-center">
            <p className="text-base font-bold text-ink">
              조건에 맞는 신상이 아직 없습니다
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink3">
              기간을 넓히거나 {isConvenience ? "카테고리, 브랜드" : "업종, 브랜드"} 필터를
              바꿔보세요. 공식 채널 기준 데이터만 보여드립니다.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              {visibleProducts.map((product) => (
                <NewProductCard key={product.id} product={product} />
              ))}
            </div>

            <div ref={sentinelRef} aria-hidden="true" className="h-8 w-full" />

            {hasMore ? (
              <p className="py-4 text-center text-xs text-ink4">
                불러오는 중…
              </p>
            ) : (
              <p className="py-4 text-center text-xs text-ink4">
                마지막까지 모두 확인했어요
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}
