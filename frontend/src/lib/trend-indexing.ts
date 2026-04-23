import type { Trend } from "./types";

interface TrendIndexCandidate {
  description?: string | null;
  store_count?: number | null;
  status?: Trend["status"] | string | null;
}

const MIN_INDEXABLE_DESCRIPTION_LENGTH = 25;
const MIN_INDEXABLE_STORE_COUNT = 2;

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function hasSubstantiveTrendDescription(
  description: string | null | undefined
): boolean {
  return normalizeText(description).length >= MIN_INDEXABLE_DESCRIPTION_LENGTH;
}

export function isTrendEligibleForIndexing(
  trend: TrendIndexCandidate | null | undefined
): boolean {
  if (!trend) {
    return false;
  }

  if (trend.status === "watchlist" || trend.status === "inactive") {
    return false;
  }

  if (!hasSubstantiveTrendDescription(trend.description)) {
    return false;
  }

  return Number(trend.store_count ?? 0) >= MIN_INDEXABLE_STORE_COUNT;
}

export function formatTrendDetectedDate(value: string | null | undefined): string {
  if (!value) {
    return "최근";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "최근";
  }

  return parsed.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
}

export function getTrendStatusSummary(status: Trend["status"]): string {
  switch (status) {
    case "rising":
      return "최근 검색 반응과 언급량이 빠르게 붙는 구간입니다.";
    case "active":
      return "현재도 관심이 이어지는 메인 트렌드 구간입니다.";
    case "declining":
      return "정점 이후 반응이 다소 완만해졌지만 판매처 수요는 남아 있을 수 있습니다.";
    case "watchlist":
      return "초기 신호 단계라 자동 노출보다 관찰이 우선인 후보입니다.";
    case "inactive":
      return "현재는 운영 기준상 비활성 상태로 관리 중입니다.";
    default:
      return "최근 데이터 흐름을 기준으로 상태를 갱신하고 있습니다.";
  }
}

export function getTrendCategorySummary(category: string): string {
  switch (category) {
    case "디저트":
      return "디저트 트렌드는 시즌성, 비주얼, SNS 저장 수요에 영향을 크게 받습니다.";
    case "음료":
      return "음료 트렌드는 계절감, 한정 출시, 브랜드 확산 속도가 중요합니다.";
    case "식사":
      return "식사 메뉴는 프랜차이즈 확산과 실제 판매처 접근성이 함께 중요합니다.";
    case "간식":
      return "간식류는 편의점 신상과 SNS 후기 누적이 반응 속도를 좌우합니다.";
    default:
      return "이 메뉴는 검색 반응, 후기 축적, 판매처 접근성을 함께 보고 해석해야 합니다.";
  }
}
