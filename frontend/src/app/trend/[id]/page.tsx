import type { Metadata } from "next";
import KakaoSdkScripts from "@/components/KakaoSdkScripts";
import TrendDetailPageClient from "./TrendDetailPageClient";
import { buildMetadata, buildTrendDescription } from "@/lib/seo";
import {
  buildBreadcrumbJsonLd,
  buildTrendArticleJsonLd,
  buildTrendStoresItemListJsonLd,
  jsonLdScript,
} from "@/lib/structured-data";
import { isTrendEligibleForIndexing } from "@/lib/trend-indexing";
import { getTrendDetailById } from "@/lib/trends-server";

export const revalidate = 3600;

interface TrendPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: TrendPageProps): Promise<Metadata> {
  const { id } = await params;
  const trendData = await getTrendDetailById(id);

  if (!trendData) {
    return buildMetadata({
      title: "트렌드를 찾을 수 없어요",
      description: "요청한 트렌드 정보를 찾을 수 없습니다.",
      path: `/trend/${id}`,
      noIndex: true,
    });
  }

  const canIndex = isTrendEligibleForIndexing(trendData.trend);

  return buildMetadata({
    title: `${trendData.trend.name} 판매처 지도`,
    description: buildTrendDescription({
      name: trendData.trend.name,
      description: trendData.trend.description,
      storeCount: trendData.trend.store_count,
      detectedAt: trendData.trend.detected_at,
    }),
    path: `/trend/${id}`,
    image: trendData.trend.image_url,
    keywords: [
      trendData.trend.name,
      `${trendData.trend.name} 판매처`,
      `${trendData.trend.name} 지도`,
      `${trendData.trend.name} 맛집`,
    ],
    noIndex: !canIndex,
    type: "article",
  });
}

export default async function TrendDetailPage({ params }: TrendPageProps) {
  const { id } = await params;
  const trendData = await getTrendDetailById(id);
  const structuredData = trendData
    ? [
        buildBreadcrumbJsonLd([
          { name: "홈", path: "/" },
          { name: "트렌드", path: "/trend" },
          { name: trendData.trend.name, path: `/trend/${id}` },
        ]),
        buildTrendArticleJsonLd(trendData.trend, `/trend/${id}`),
        buildTrendStoresItemListJsonLd(
          trendData.trend,
          trendData.stores,
          `/trend/${id}`
        ),
      ]
    : [];

  return (
    <>
      {structuredData.map((item, index) => (
        <script
          key={`trend-detail-json-ld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(item)}
        />
      ))}
      <KakaoSdkScripts />
      <TrendDetailPageClient
        id={id}
        initialTrend={trendData?.trend ?? null}
        initialStores={trendData?.stores ?? []}
      />
    </>
  );
}
