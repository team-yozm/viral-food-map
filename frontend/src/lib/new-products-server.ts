import type { NewProduct, NewProductSource, NewProductSourceType } from "./types";
import { createServerSupabaseClient } from "./supabase-server";

export type NewProductsPeriod = "1d" | "3d" | "7d" | "30d" | "all";
export type NewProductsSourceFilter = "all" | NewProductSourceType;

export interface NewProductListItem extends NewProduct {
  source: Pick<
    NewProductSource,
    "id" | "source_key" | "title" | "brand" | "source_type" | "channel" | "site_url"
  > | null;
  effective_at: string;
  filter_at: string | null;
  date_label: "공개일" | "첫 수집";
}

export interface NewProductsPageData {
  products: NewProductListItem[];
  sourceCounts: Record<NewProductSourceType, number>;
  totalCount: number;
  lastUpdated: string | null;
}

interface NewProductsPageOptions {
  period: NewProductsPeriod;
  sourceType: NewProductsSourceFilter;
}

const PERIOD_DAYS: Record<Exclude<NewProductsPeriod, "all">, number> = {
  "1d": 1,
  "3d": 3,
  "7d": 7,
  "30d": 30,
};

function getFilterDate(
  product: Pick<NewProduct, "published_at" | "available_from">
): string | null {
  return product.published_at || product.available_from || null;
}

function getEffectiveDate(
  product: Pick<NewProduct, "published_at" | "available_from" | "first_seen_at">
) {
  return getFilterDate(product) || product.first_seen_at;
}

function getDateLabel(
  product: Pick<NewProduct, "published_at" | "available_from">
): "공개일" | "첫 수집" {
  return getFilterDate(product) ? "공개일" : "첫 수집";
}

function sortByEffectiveDateDesc(a: NewProductListItem, b: NewProductListItem) {
  return (
    new Date(b.effective_at).getTime() - new Date(a.effective_at).getTime()
  );
}

export async function getNewProductsPageData({
  period,
  sourceType,
}: NewProductsPageOptions): Promise<NewProductsPageData> {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return {
      products: [],
      sourceCounts: {
        convenience: 0,
        franchise: 0,
      },
      totalCount: 0,
      lastUpdated: null,
    };
  }

  const { data } = await supabase
    .from("new_products")
    .select(
      "*, source:new_product_sources(id, source_key, title, brand, source_type, channel, site_url)"
    )
    .eq("status", "visible")
    .eq("is_food", true)
    .order("last_seen_at", { ascending: false })
    .limit(300);

  const now = Date.now();
  const cutoffMs =
    period === "all" ? null : now - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;

  const rows = ((data as (NewProduct & {
    source?: Pick<
      NewProductSource,
      "id" | "source_key" | "title" | "brand" | "source_type" | "channel" | "site_url"
    > | null;
  })[]) ?? []);

  const mapped = rows
    .map((product) => ({
      ...product,
      source: product.source ?? null,
      effective_at: getEffectiveDate(product),
      filter_at: getFilterDate(product),
      date_label: getDateLabel(product),
    }))
    .filter((product) => {
      if (sourceType !== "all" && product.source_type !== sourceType) {
        return false;
      }

      if (cutoffMs === null) {
        return true;
      }

      if (!product.filter_at) {
        return false;
      }

      return new Date(product.filter_at).getTime() >= cutoffMs;
    })
    .sort(sortByEffectiveDateDesc);

  const sourceCounts = mapped.reduce(
    (counts, product) => {
      counts[product.source_type] += 1;
      return counts;
    },
    { convenience: 0, franchise: 0 } satisfies Record<NewProductSourceType, number>
  );

  return {
    products: mapped,
    sourceCounts,
    totalCount: mapped.length,
    lastUpdated: rows[0]?.last_seen_at ?? null,
  };
}
