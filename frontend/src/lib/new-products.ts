import type {
  NewProductSectorFilter,
  NewProductSectorKey,
} from "./new-product-taxonomy";

export type NewProductsPeriod = "1d" | "3d" | "7d" | "30d" | "all";
export type NewProductSourceFilter = "franchise" | "convenience";

export interface NewProductBrandOption {
  key: string;
  label: string;
  count: number;
}

export interface NewProductCategoryOption {
  key: string;
  label: string;
  count: number;
}

export interface NewProductDisplaySource {
  title: string;
  site_url: string | null;
}

export interface NewProductDisplayItem {
  id: string;
  name: string;
  brand: string;
  channel: string;
  category: string | null;
  summary: string | null;
  image_url: string | null;
  product_url: string | null;
  is_limited: boolean;
  source_type: NewProductSourceFilter;
  source_label: string;
  source: NewProductDisplaySource | null;
  effective_at: string;
  filter_at: string | null;
  date_label: "공개일" | "첫 수집";
  brand_label: string;
  sector_key: NewProductSectorKey;
  sector_label: string;
}

export type NewProductListItem = NewProductDisplayItem;

export interface NewProductsViewData {
  products: NewProductDisplayItem[];
  sectorCounts: Record<NewProductSectorKey, number>;
  categoryOptions: NewProductCategoryOption[];
  brandOptions: NewProductBrandOption[];
  brandCount: number;
  totalCount: number;
  selectedCategory: string | null;
  selectedBrand: string | null;
}

interface DeriveNewProductsViewOptions {
  source: NewProductSourceFilter;
  period: NewProductsPeriod;
  sector: NewProductSectorFilter;
  category: string;
  brand: string | null;
}

const PERIOD_DAYS: Record<Exclude<NewProductsPeriod, "all">, number> = {
  "1d": 1,
  "3d": 3,
  "7d": 7,
  "30d": 30,
};

function sortByEffectiveDateDesc(a: NewProductDisplayItem, b: NewProductDisplayItem) {
  return new Date(b.effective_at).getTime() - new Date(a.effective_at).getTime();
}

export function createEmptySectorCounts(): Record<NewProductSectorKey, number> {
  return {
    cafe: 0,
    burger: 0,
    pizza: 0,
    sandwich: 0,
    other: 0,
  };
}

function buildBrandOptions(products: NewProductDisplayItem[]): NewProductBrandOption[] {
  const counts = new Map<string, { label: string; count: number }>();

  products.forEach((product) => {
    const current = counts.get(product.brand);

    if (current) {
      current.count += 1;
      return;
    }

    counts.set(product.brand, {
      label: product.brand_label,
      count: 1,
    });
  });

  return Array.from(counts.entries())
    .map(([key, value]) => ({
      key,
      label: value.label,
      count: value.count,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return a.label.localeCompare(b.label, "ko-KR");
    });
}

function getConvenienceCategoryGroup(product: NewProductDisplayItem) {
  const category = product.category?.trim() || "기타";

  if (
    category.includes("도시락") ||
    category.includes("조리면") ||
    category.includes("정식") ||
    category.includes("덮밥")
  ) {
    return { key: "meal", label: "도시락/조리면" };
  }

  if (
    category.includes("김밥") ||
    category.includes("주먹밥") ||
    category.includes("삼각")
  ) {
    return { key: "rice", label: "김밥/주먹밥" };
  }

  if (
    category.includes("샌드위치") ||
    category.includes("샌드") ||
    category.includes("햄버거") ||
    category.includes("버거")
  ) {
    return { key: "sandwich", label: "샌드위치/햄버거" };
  }

  if (
    category.includes("간편식") ||
    category.includes("즉석식") ||
    category.includes("Fresh Food")
  ) {
    return { key: "snack", label: "간편식/즉석식" };
  }

  return { key: "other", label: "기타" };
}

function buildCategoryOptions(
  products: NewProductDisplayItem[]
): NewProductCategoryOption[] {
  const counts = new Map<string, { label: string; count: number }>();

  products.forEach((product) => {
    const { key, label } = getConvenienceCategoryGroup(product);
    const current = counts.get(key);

    if (current) {
      current.count += 1;
      return;
    }

    counts.set(key, {
      label,
      count: 1,
    });
  });

  return Array.from(counts.entries())
    .map(([key, value]) => ({
      key,
      label: value.label,
      count: value.count,
    }))
    .sort((a, b) => {
      const order = ["meal", "rice", "sandwich", "snack", "other"];
      return order.indexOf(a.key) - order.indexOf(b.key);
    });
}

export function deriveNewProductsView(
  products: NewProductDisplayItem[],
  { source, period, sector, category, brand }: DeriveNewProductsViewOptions
): NewProductsViewData {
  const now = Date.now();
  const cutoffMs =
    period === "all" ? null : now - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  const filteredBySource = products.filter(
    (product) => product.source_type === source
  );

  const filteredByPeriod = filteredBySource.filter((product) => {
    if (cutoffMs === null) {
      return true;
    }

    if (!product.filter_at) {
      return false;
    }

    return new Date(product.filter_at).getTime() >= cutoffMs;
  });

  const sectorCounts = filteredByPeriod.reduce((counts, product) => {
    counts[product.sector_key] += 1;
    return counts;
  }, createEmptySectorCounts());
  const categoryOptions =
    source === "convenience" ? buildCategoryOptions(filteredByPeriod) : [];
  const selectedCategory =
    source === "convenience" &&
    category !== "all" &&
    categoryOptions.some((option) => option.key === category)
      ? category
      : null;

  const filteredBySector =
    source === "convenience" || sector === "all"
      ? filteredByPeriod
      : filteredByPeriod.filter((product) => product.sector_key === sector);
  const filteredByCategory =
    source === "convenience" && selectedCategory
      ? filteredBySector.filter(
          (product) => getConvenienceCategoryGroup(product).key === selectedCategory
        )
      : filteredBySector;

  const brandOptions =
    (source === "convenience" && selectedCategory) ||
    (source === "franchise" && sector !== "all")
      ? buildBrandOptions(filteredByCategory)
      : [];
  const selectedBrand =
    !brand || brandOptions.length === 0
      ? null
      : brandOptions.some((option) => option.key === brand)
        ? brand
        : null;

  const filteredProducts = filteredByCategory
    .filter((product) => {
      if (!selectedBrand) {
        return true;
      }

      return product.brand === selectedBrand;
    })
    .sort(sortByEffectiveDateDesc);
  const brandCountProducts =
    source === "convenience" ? filteredByCategory : filteredByPeriod;

  return {
    products: filteredProducts,
    sectorCounts,
    categoryOptions,
    brandOptions,
    brandCount: new Set(brandCountProducts.map((product) => product.brand)).size,
    totalCount: filteredProducts.length,
    selectedCategory,
    selectedBrand,
  };
}
