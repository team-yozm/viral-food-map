import type { NewProductDisplayItem } from "./new-products";
import { absoluteUrl, buildTrendDescription } from "./seo";
import { SITE_NAME, SITE_URL } from "./site";
import type { Store, Trend } from "./types";

type TrendWithStoreCount = Trend & {
  store_count?: number | null;
};

interface BreadcrumbItem {
  name: string;
  path: string;
}

const MAX_STRUCTURED_DATA_ITEMS = 20;

function resolveUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return absoluteUrl(path);
}

export function jsonLdScript(value: unknown) {
  return {
    __html: JSON.stringify(value).replace(/</g, "\\u003c"),
  };
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: resolveUrl(item.path),
    })),
  };
}

export function buildWebPageJsonLd({
  name,
  description,
  path,
}: {
  name: string;
  description: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: resolveUrl(path),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

export function buildTrendArticleJsonLd(trend: TrendWithStoreCount, path: string) {
  const description = buildTrendDescription({
    name: trend.name,
    description: trend.description,
    storeCount: trend.store_count ?? 0,
    detectedAt: trend.detected_at,
  });

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${trend.name} 판매처 지도`,
    description,
    image: trend.image_url ? resolveUrl(trend.image_url) : absoluteUrl("/og-image.png"),
    datePublished: trend.detected_at,
    dateModified: trend.detected_at,
    inLanguage: "ko-KR",
    mainEntityOfPage: resolveUrl(path),
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/logo.png"),
      },
    },
  };
}

export function buildTrendStoresItemListJsonLd(
  trend: TrendWithStoreCount,
  stores: Store[],
  path: string
) {
  const visibleStores = stores.slice(0, MAX_STRUCTURED_DATA_ITEMS);

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${trend.name} 판매처`,
    description: `${trend.name}을(를) 판매하는 매장 목록입니다.`,
    numberOfItems: stores.length,
    url: resolveUrl(path),
    itemListElement: visibleStores.map((store, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "FoodEstablishment",
        name: store.name,
        address: store.address,
        url: store.place_url || resolveUrl(path),
        geo: {
          "@type": "GeoCoordinates",
          latitude: store.lat,
          longitude: store.lng,
        },
        servesCuisine: trend.category,
      },
    })),
  };
}

export function buildTrendRankingItemListJsonLd(trends: TrendWithStoreCount[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "바이럴 음식 트렌드 랭킹",
    itemListElement: trends
      .slice(0, MAX_STRUCTURED_DATA_ITEMS)
      .map((trend, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/trend/${trend.id}`),
        name: trend.name,
      })),
  };
}

export function buildNewProductsItemListJsonLd(
  products: NewProductDisplayItem[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "신상 음식 모아보기",
    itemListElement: products
      .slice(0, MAX_STRUCTURED_DATA_ITEMS)
      .map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Product",
          name: product.name,
          brand: {
            "@type": "Brand",
            name: product.brand_label,
          },
          category: product.category || product.sector_label,
          image: product.image_url ? resolveUrl(product.image_url) : undefined,
          url: product.product_url || product.source?.site_url || absoluteUrl("/new"),
          releaseDate: product.filter_at || product.effective_at,
        },
      })),
  };
}
