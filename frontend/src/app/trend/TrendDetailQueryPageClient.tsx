"use client";

import { useSearchParams } from "next/navigation";

import TrendDetailPageClient from "./TrendDetailPageClient";

export default function TrendDetailQueryPageClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  if (!id) {
    return (
      <main className="page-with-bottom-nav max-w-lg mx-auto px-4 py-12 text-center text-gray-400">
        <p className="text-4xl mb-3">🔎</p>
        <p>트렌드 정보가 없습니다.</p>
      </main>
    );
  }

  return <TrendDetailPageClient id={id} initialTrend={null} initialStores={[]} />;
}
