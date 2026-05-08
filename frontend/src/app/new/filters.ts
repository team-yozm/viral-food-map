import type {
  NewProductSourceFilter,
  NewProductsPeriod,
} from "@/lib/new-products";
import {
  NEW_PRODUCT_SECTOR_OPTIONS,
  getNewProductSectorLabel,
  type NewProductSectorFilter,
} from "@/lib/new-product-taxonomy";

export const PERIOD_OPTIONS: Array<{ key: NewProductsPeriod; label: string }> = [
  { key: "1d", label: "오늘" },
  { key: "3d", label: "3일" },
  { key: "7d", label: "7일" },
  { key: "30d", label: "30일" },
  { key: "all", label: "전체" },
];

export const SOURCE_OPTIONS: Array<{
  key: NewProductSourceFilter;
  label: string;
}> = [
  { key: "franchise", label: "프랜차이즈" },
  { key: "convenience", label: "편의점" },
];

export const SECTOR_OPTIONS = NEW_PRODUCT_SECTOR_OPTIONS;

// 기본값 "30d"는 UI 노출 기간(출시일 기준 최근 30일).
// 크롤러의 NEW_PRODUCTS_LOOKBACK_DAYS(수집 범위)와는 별개 개념이며
// 우연히 같은 값일 뿐이다.
export function normalizePeriod(period?: string): NewProductsPeriod {
  return PERIOD_OPTIONS.some((option) => option.key === period)
    ? (period as NewProductsPeriod)
    : "30d";
}

export function normalizeSource(source?: string): NewProductSourceFilter {
  return source === "convenience" ? "convenience" : "franchise";
}

export function normalizeSector(sector?: string): NewProductSectorFilter {
  return SECTOR_OPTIONS.some((option) => option.key === sector)
    ? (sector as NewProductSectorFilter)
    : "all";
}

export function normalizeBrand(brand?: string) {
  const trimmed = brand?.trim();
  return trimmed ? trimmed : null;
}

export function buildFilterHref(
  source: NewProductSourceFilter,
  period: NewProductsPeriod,
  sector: NewProductSectorFilter,
  brand?: string | null
) {
  const params = new URLSearchParams();

  if (source !== "franchise") {
    params.set("source", source);
  }

  if (period !== "30d") {
    params.set("period", period);
  }

  if (source === "franchise" && sector !== "all") {
    params.set("sector", sector);
  }

  if ((source === "convenience" || sector !== "all") && brand) {
    params.set("brand", brand);
  }

  const query = params.toString();
  return query ? `/new?${query}` : "/new";
}

export function getPeriodLabel(period: NewProductsPeriod) {
  return PERIOD_OPTIONS.find((option) => option.key === period)?.label ?? "30일";
}

export function getSectorLabel(sector: NewProductSectorFilter) {
  return getNewProductSectorLabel(sector);
}
