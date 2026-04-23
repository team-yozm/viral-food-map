import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import {
  buildBreadcrumbJsonLd,
  buildTrendRankingItemListJsonLd,
  buildWebPageJsonLd,
  jsonLdScript,
} from "@/lib/structured-data";
import { getActiveTrends } from "@/lib/trends-server";
import TrendListClient from "./TrendListClient";

export const revalidate = 300;

export const metadata: Metadata = buildMetadata({
  title: "트렌드 랭킹",
  description: "SNS, 포털 검색, 판매처 데이터로 집계한 이번 주 바이럴 음식 트렌드 순위.",
  path: "/trend",
});

export default async function TrendListPage() {
  const trends = await getActiveTrends();
  const structuredData = [
    buildWebPageJsonLd({
      name: "트렌드 랭킹",
      description: "SNS, 포털 검색, 판매처 데이터로 집계한 이번 주 바이럴 음식 트렌드 순위.",
      path: "/trend",
    }),
    buildBreadcrumbJsonLd([
      { name: "홈", path: "/" },
      { name: "트렌드", path: "/trend" },
    ]),
    buildTrendRankingItemListJsonLd(trends),
  ];

  return (
    <>
      {structuredData.map((item, index) => (
        <script
          key={`trend-list-json-ld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(item)}
        />
      ))}
      <TrendListClient initialTrends={trends} />
    </>
  );
}
