import { cache } from "react";

import { createServerSupabaseClient } from "./supabase-server";
import type {
  YomechuCategorySlug,
  YomechuPlaceRow,
  YomechuSpinRow,
} from "./types";

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

export interface SharedYomechuPlace {
  place_id: string;
  name: string;
  address: string;
  category_label: string;
  rating: number | null;
  trend_names: string[];
  place_url: string;
}

export interface SharedYomechuSpinData {
  spin: YomechuSpinRow;
  winners: SharedYomechuPlace[];
  primaryWinner: SharedYomechuPlace | null;
}

function resolveCategoryLabel(place: YomechuPlaceRow, fallbackSlug: YomechuCategorySlug) {
  const parts = place.category_name
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.at(-1) || CATEGORY_LABELS[place.category_slug] || CATEGORY_LABELS[fallbackSlug];
}

function toSharedPlace(place: YomechuPlaceRow, fallbackSlug: YomechuCategorySlug): SharedYomechuPlace {
  return {
    place_id: place.id,
    name: place.name,
    address: place.address,
    category_label: resolveCategoryLabel(place, fallbackSlug),
    rating: place.rating !== null ? Number(place.rating) : null,
    trend_names: place.trend_names ?? [],
    place_url: place.place_url || `https://map.kakao.com/link/search/${encodeURIComponent(place.name)}`,
  };
}

function getWinnerIds(spin: YomechuSpinRow) {
  if (Array.isArray(spin.winner_place_ids) && spin.winner_place_ids.length > 0) {
    return spin.winner_place_ids;
  }

  return spin.winner_place_id ? [spin.winner_place_id] : [];
}

export const getSharedYomechuSpinById = cache(
  async (spinId: string): Promise<SharedYomechuSpinData | null> => {
    const supabase = createServerSupabaseClient(3600);

    if (!supabase) {
      return null;
    }

    const { data: spinData } = await supabase
      .from("yomechu_spins")
      .select("*")
      .eq("id", spinId)
      .single();

    if (!spinData) {
      return null;
    }

    const spin = spinData as YomechuSpinRow;
    const winnerIds = getWinnerIds(spin);

    if (winnerIds.length === 0) {
      return {
        spin,
        winners: [],
        primaryWinner: null,
      };
    }

    const { data: winnerRows } = await supabase
      .from("yomechu_places")
      .select("*")
      .in("id", winnerIds);

    const winnerMap = new Map(
      ((winnerRows as YomechuPlaceRow[] | null) ?? []).map((row) => [row.id, row])
    );

    const winners = winnerIds
      .map((winnerId) => winnerMap.get(winnerId))
      .filter((row): row is YomechuPlaceRow => Boolean(row))
      .map((row) => toSharedPlace(row, spin.category_slug));

    return {
      spin,
      winners,
      primaryWinner: winners[0] ?? null,
    };
  }
);

export function buildYomechuShareDescription(
  primaryWinner: SharedYomechuPlace | null,
  winnerCount: number
) {
  if (!primaryWinner) {
    return "공유된 요메추 추천 결과를 확인해보세요.";
  }

  if (winnerCount > 1) {
    return `${primaryWinner.name} 포함 추천 ${winnerCount}곳을 요즘뭐먹에서 확인해보세요.`;
  }

  return `${primaryWinner.name} 추천 결과를 요즘뭐먹에서 확인해보세요.`;
}
