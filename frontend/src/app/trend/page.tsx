import type { Metadata } from "next";
import { Suspense } from "react";

import KakaoSdkScripts from "@/components/KakaoSdkScripts";
import { buildMetadata } from "@/lib/seo";

import TrendDetailQueryPageClient from "./TrendDetailQueryPageClient";

export const metadata: Metadata = buildMetadata({
  title: "트렌드 상세",
  description: "현재 선택한 음식 트렌드의 설명과 판매처 정보를 확인하세요.",
  path: "/trend",
  noIndex: true,
});

function TrendQueryLoading() {
  return (
    <main className="page-with-bottom-nav max-w-lg mx-auto px-4 py-12 text-center text-gray-400">
      <p className="text-4xl mb-3">🍽️</p>
      <p>트렌드 정보를 준비하고 있어요.</p>
    </main>
  );
}

export default function TrendQueryPage() {
  return (
    <>
      <KakaoSdkScripts />
      <Suspense fallback={<TrendQueryLoading />}>
        <TrendDetailQueryPageClient />
      </Suspense>
    </>
  );
}
