"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

import NewProductCard from "@/components/NewProductCard";
import {
  deriveNewProductsView,
  type NewProductBrandOption,
  type NewProductListItem,
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
  initialBrandOptions: NewProductBrandOption[];
  initialBrandCount: number;
  initialTotalCount: number;
  initialLastUpdated: string | null;
  initialPeriod: NewProductsPeriod;
  initialSector: NewProductSectorFilter;
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
  period: NewProductsPeriod;
  sector: NewProductSectorFilter;
  brand: string | null;
}

type IdleCapableWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (callback: () => void) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

let catalogRequestPromise: Promise<CatalogResponse> | null = null;

function fetchNewProductsCatalog() {
  if (!catalogRequestPromise) {
    catalogRequestPromise = fetch("/api/new-products/catalog")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch new products catalog.");
        }

        return (await response.json()) as CatalogResponse;
      })
      .catch((error) => {
        catalogRequestPromise = null;
        throw error;
      });
  }

  return catalogRequestPromise;
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

  return parsed.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  initialBrandOptions,
  initialBrandCount,
  initialTotalCount,
  initialLastUpdated,
  initialPeriod,
  initialSector,
  initialBrand,
}: NewProductsClientProps) {
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const initialView = useMemo<NewProductsViewData>(
    () => ({
      products: initialProducts,
      sectorCounts: initialSectorCounts,
      brandOptions: initialBrandOptions,
      brandCount: initialBrandCount,
      totalCount: initialTotalCount,
      selectedBrand: initialBrand,
    }),
    [
      initialProducts,
      initialSectorCounts,
      initialBrandOptions,
      initialBrandCount,
      initialTotalCount,
      initialBrand,
    ]
  );

  const [filters, setFilters] = useState<FilterState>({
    period: initialPeriod,
    sector: initialSector,
    brand: initialBrand,
  });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("idle");
  const [filterMode, setFilterMode] = useState<FilterMode>("server");
  const [catalogData, setCatalogData] = useState<CatalogResponse | null>(null);

  useEffect(() => {
    setFilters({
      period: initialPeriod,
      sector: initialSector,
      brand: initialBrand,
    });
    setFilterMode("server");
  }, [initialPeriod, initialSector, initialBrand, initialTotalCount]);

  useEffect(() => {
    let cancelled = false;

    setCatalogStatus((current) => (current === "ready" ? current : "loading"));

    const cancelScheduledTask = scheduleIdleTask(() => {
      void fetchNewProductsCatalog()
        .then((data) => {
          if (cancelled) {
            return;
          }

          setCatalogData(data);
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
  }, []);

  const clientView = useMemo(() => {
    if (filterMode !== "client" || !catalogData) {
      return null;
    }

    return deriveNewProductsView(catalogData.products, filters);
  }, [catalogData, filterMode, filters]);

  const currentView = clientView ?? initialView;
  const currentPeriod = filterMode === "client" ? filters.period : initialPeriod;
  const currentSector = filterMode === "client" ? filters.sector : initialSector;
  const currentBrand = currentView.selectedBrand;
  const currentLastUpdated =
    filterMode === "client"
      ? catalogData?.lastUpdated ?? initialLastUpdated
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
  const selectedBrandLabel =
    currentView.brandOptions.find((option) => option.key === currentBrand)?.label ??
    currentBrand;
  const hasMore = visibleCount < currentView.products.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [currentPeriod, currentSector, currentBrand, filterMode]);

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
    nextBrand: string | null = currentBrand
  ) => {
    const requestedFilters: FilterState = {
      period: nextPeriod,
      sector: nextSector,
      brand: nextSector === "all" ? null : nextBrand,
    };

    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    setOpenDropdown(null);

    if (catalogStatus !== "ready" || !catalogData) {
      router.replace(
        buildFilterHref(
          requestedFilters.period,
          requestedFilters.sector,
          requestedFilters.brand
        ),
        { scroll: false }
      );
      return;
    }

    const nextView = deriveNewProductsView(catalogData.products, requestedFilters);
    const nextFilters: FilterState = {
      ...requestedFilters,
      brand: nextView.selectedBrand,
    };

    startTransition(() => {
      setFilterMode("client");
      setFilters(nextFilters);
    });

    window.history.replaceState(
      {},
      "",
      buildFilterHref(nextFilters.period, nextFilters.sector, nextFilters.brand)
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

      <section className="mb-4 flex flex-wrap gap-1.5">
        {PERIOD_OPTIONS.map((option) => {
          const active = currentPeriod === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => applyFilter(option.key, currentSector, currentBrand)}
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
          <p className="text-[11px] font-bold text-ink3">업종</p>
          <span className="text-[11px] text-ink4">
            {currentView.totalCount}개 · 브랜드 {currentView.brandCount}곳
          </span>
        </div>
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

        {currentSector !== "all" && currentView.brandOptions.length > 0 ? (
          <>
            <p className="mt-4 mb-2 text-[11px] font-bold text-ink3">
              브랜드
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyFilter(currentPeriod, currentSector, null)}
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
                    applyFilter(currentPeriod, currentSector, option.key)
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
              기간을 넓히거나 업종, 브랜드 필터를 바꿔보세요. 공식 채널 기준
              데이터만 보여드립니다.
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
