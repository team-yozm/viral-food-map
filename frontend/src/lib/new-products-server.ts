import { unstable_cache } from "next/cache";

import {
  deriveNewProductsView,
  type NewProductDisplayItem,
  type NewProductDisplaySource,
  type NewProductSourceFilter,
  type NewProductsPeriod,
  type NewProductsViewData,
} from "./new-products";
import type { NewProductSectorFilter } from "./new-product-taxonomy";
import { createServerSupabaseClient } from "./supabase-server";
import {
  getNewProductBrandLabel,
  getNewProductSectorKey,
  getNewProductSectorLabel,
} from "./new-product-taxonomy";
import type { NewProduct, NewProductSource } from "./types";

export type {
  NewProductBrandOption,
  NewProductDisplayItem,
  NewProductDisplaySource,
  NewProductListItem,
  NewProductSourceFilter,
  NewProductsPeriod,
  NewProductsViewData,
} from "./new-products";

export interface NewProductsPageData extends NewProductsViewData {
  lastUpdated: string | null;
}

export interface NewProductsCatalogData {
  products: NewProductDisplayItem[];
  lastUpdated: string | null;
}

interface NewProductsPageOptions {
  source: NewProductSourceFilter;
  period: NewProductsPeriod;
  sector: NewProductSectorFilter;
  brand: string | null;
}

type NewProductSourceQueryRow = Pick<
  NewProductSource,
  "title" | "brand" | "site_url" | "discovery_metadata"
>;

type NewProductQueryRow = Pick<
  NewProduct,
  | "id"
  | "name"
  | "brand"
  | "channel"
  | "category"
  | "summary"
  | "image_url"
  | "product_url"
  | "source_type"
  | "published_at"
  | "available_from"
  | "first_seen_at"
  | "last_seen_at"
  | "is_limited"
> & {
  source?: NewProductSourceQueryRow | null;
};

function getFilterDate(
  product: Pick<
    NewProduct,
    "published_at" | "available_from" | "first_seen_at"
  >
): string | null {
  return product.published_at || product.available_from || product.first_seen_at;
}

function getEffectiveDate(
  product: Pick<
    NewProduct,
    "published_at" | "available_from" | "first_seen_at"
  >
) {
  return getFilterDate(product) || product.first_seen_at;
}

function getDateLabel(
  product: Pick<NewProduct, "published_at" | "available_from">
): "공개일" | "첫 수집" {
  return product.published_at || product.available_from ? "공개일" : "첫 수집";
}

function getSourceLabel(sourceType: NewProductSourceFilter) {
  return sourceType === "convenience" ? "편의점" : "프랜차이즈";
}

function getResolvedBrand(
  product: Pick<NewProduct, "brand"> & {
    source?: Pick<NewProductSource, "brand"> | null;
  }
) {
  return product.source?.brand?.trim() || product.brand.trim();
}

function mapNewProductRow(product: NewProductQueryRow): NewProductDisplayItem {
  const resolvedBrand = getResolvedBrand(product);
  const sourceMetadata = product.source?.discovery_metadata;
  const sectorKey = getNewProductSectorKey(resolvedBrand, sourceMetadata);
  const source: NewProductDisplaySource | null = product.source
    ? {
        title: product.source.title,
        site_url: product.source.site_url,
      }
    : null;

  return {
    id: product.id,
    name: product.name,
    brand: resolvedBrand,
    channel: product.channel,
    category: product.category,
    summary: product.summary,
    image_url: product.image_url,
    product_url: product.product_url,
    is_limited: product.is_limited,
    source_type: product.source_type,
    source_label: getSourceLabel(product.source_type),
    source,
    effective_at: getEffectiveDate(product),
    filter_at: getFilterDate(product),
    date_label: getDateLabel(product),
    brand_label: getNewProductBrandLabel(resolvedBrand, sourceMetadata),
    sector_key: sectorKey,
    sector_label: getNewProductSectorLabel(sectorKey),
  };
}

const getCachedVisibleNewProducts = unstable_cache(
  async (source: NewProductSourceFilter): Promise<NewProductQueryRow[]> => {
    const supabase = createServerSupabaseClient();

    if (!supabase) {
      return [];
    }

    const { data } = await supabase
      .from("new_products")
      .select(
        [
          "id",
          "name",
          "brand",
          "channel",
          "category",
          "summary",
          "image_url",
          "product_url",
          "source_type",
          "published_at",
          "available_from",
          "first_seen_at",
          "last_seen_at",
          "is_limited",
          "source:new_product_sources(title, brand, site_url, discovery_metadata)",
        ].join(", ")
      )
      .eq("status", "visible")
      .eq("is_food", true)
      .eq("source_type", source)
      .order("last_seen_at", { ascending: false })
      .limit(1000);

    return Array.isArray(data)
      ? (data as unknown as NewProductQueryRow[])
      : [];
  },
  ["visible-new-products"],
  { revalidate: 300 }
);

export async function getNewProductsCatalogData(
  source: NewProductSourceFilter = "franchise"
): Promise<NewProductsCatalogData> {
  const rows = await getCachedVisibleNewProducts(source);

  return {
    products: rows.map(mapNewProductRow),
    lastUpdated: rows[0]?.last_seen_at ?? null,
  };
}

export async function getNewProductsPageData({
  source,
  period,
  sector,
  brand,
}: NewProductsPageOptions): Promise<NewProductsPageData> {
  const rows = await getCachedVisibleNewProducts(source);

  const products = rows.map(mapNewProductRow);
  const lastUpdated = rows[0]?.last_seen_at ?? null;
  const view = deriveNewProductsView(products, { source, period, sector, brand });

  return {
    ...view,
    lastUpdated,
  };
}
