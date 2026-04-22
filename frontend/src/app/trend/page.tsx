import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
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
  return <TrendListClient initialTrends={trends} />;
}
