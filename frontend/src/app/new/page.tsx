import type { Metadata } from "next";

import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import { getNewProductsPageData } from "@/lib/new-products-server";
import { buildMetadata } from "@/lib/seo";
import {
  buildBreadcrumbJsonLd,
  buildNewProductsItemListJsonLd,
  buildWebPageJsonLd,
  jsonLdScript,
} from "@/lib/structured-data";

import NewProductsClient from "./NewProductsClient";
import { normalizeBrand, normalizePeriod, normalizeSector } from "./filters";

interface NewProductsPageProps {
  searchParams?: Promise<{
    period?: string;
    sector?: string;
    brand?: string;
    source?: string;
  }>;
}

export const metadata: Metadata = buildMetadata({
  title: "신상 음식 모아보기",
  description:
    "프랜차이즈 공식 채널의 신상 메뉴를 업종과 브랜드별로 모아봅니다.",
  path: "/new",
  keywords: ["신상 음식", "프랜차이즈 신메뉴", "브랜드 신상", "신상 메뉴"],
});

export const revalidate = 300;

export default async function NewProductsPage({
  searchParams,
}: NewProductsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const period = normalizePeriod(resolvedSearchParams.period);
  const sector = normalizeSector(resolvedSearchParams.sector);
  const brand = normalizeBrand(resolvedSearchParams.brand);
  const pageData = await getNewProductsPageData({ period, sector, brand });
  const structuredData = [
    buildWebPageJsonLd({
      name: "신상 음식 모아보기",
      description: "프랜차이즈 공식 채널의 신상 메뉴를 업종과 브랜드별로 모아봅니다.",
      path: "/new",
    }),
    buildBreadcrumbJsonLd([
      { name: "홈", path: "/" },
      { name: "신상", path: "/new" },
    ]),
    buildNewProductsItemListJsonLd(pageData.products),
  ];

  return (
    <>
      {structuredData.map((item, index) => (
        <script
          key={`new-products-json-ld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(item)}
        />
      ))}
      <main
        className="page-with-bottom-nav max-w-lg mx-auto px-4 pb-4"
        style={{ paddingTop: "calc(var(--safe-top) + 16px)" }}
      >
        <NewProductsClient
          initialProducts={pageData.products}
          initialSectorCounts={pageData.sectorCounts}
          initialBrandOptions={pageData.brandOptions}
          initialBrandCount={pageData.brandCount}
          initialTotalCount={pageData.totalCount}
          initialLastUpdated={pageData.lastUpdated}
          initialPeriod={period}
          initialSector={sector}
          initialBrand={pageData.selectedBrand}
        />

        <Footer />
      </main>

      <BottomNav />
    </>
  );
}
