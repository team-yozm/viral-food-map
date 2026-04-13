import Link from "next/link";
import type { Metadata } from "next";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import NewProductCard from "@/components/NewProductCard";
import { buildMetadata } from "@/lib/seo";
import {
  getNewProductsPageData,
  type NewProductsPeriod,
  type NewProductsSourceFilter,
} from "@/lib/new-products-server";

interface NewProductsPageProps {
  searchParams?: {
    period?: string;
    source?: string;
  };
}

const PERIOD_OPTIONS: Array<{ key: NewProductsPeriod; label: string }> = [
  { key: "1d", label: "오늘" },
  { key: "3d", label: "3일" },
  { key: "7d", label: "7일" },
  { key: "30d", label: "30일" },
  { key: "all", label: "전체" },
];

const SOURCE_OPTIONS: Array<{ key: NewProductsSourceFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "convenience", label: "편의점" },
  { key: "franchise", label: "프랜차이즈" },
];

export const metadata: Metadata = buildMetadata({
  title: "신상 음식 모아보기",
  description:
    "편의점과 프랜차이즈의 공식 채널에서 올라온 신상 음식과 신제품을 기간별로 모아봅니다.",
  path: "/new",
  keywords: ["신상 음식", "편의점 신상", "프랜차이즈 신메뉴", "신상 탭"],
});

function normalizePeriod(period?: string): NewProductsPeriod {
  return PERIOD_OPTIONS.some((option) => option.key === period)
    ? (period as NewProductsPeriod)
    : "7d";
}

function normalizeSource(source?: string): NewProductsSourceFilter {
  return SOURCE_OPTIONS.some((option) => option.key === source)
    ? (source as NewProductsSourceFilter)
    : "all";
}

function buildFilterHref(period: NewProductsPeriod, source: NewProductsSourceFilter) {
  const params = new URLSearchParams();
  if (period !== "7d") {
    params.set("period", period);
  }
  if (source !== "all") {
    params.set("source", source);
  }

  const query = params.toString();
  return query ? `/new?${query}` : "/new";
}

function formatUpdatedAt(value: string | null) {
  if (!value) {
    return "방금";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "방금";
  }

  return parsed.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const revalidate = 300;

export default async function NewProductsPage({
  searchParams,
}: NewProductsPageProps) {
  const period = normalizePeriod(searchParams?.period);
  const source = normalizeSource(searchParams?.source);
  const pageData = await getNewProductsPageData({ period, sourceType: source });

  return (
    <>
      <Header />
      <main className="page-with-bottom-nav mx-auto flex max-w-lg flex-col gap-8 px-4 py-4">
        <section className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#111827_0%,#312e81_45%,#9B7DD4_100%)] px-5 py-6 text-white shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white/75">하단 탭 신상</p>
              <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">
                지금 뜬 신상만
                <br />
                기간별로 모아보기
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/80">
                편의점 상품 페이지와 프랜차이즈 공식 이벤트에서 음식 위주 신상만 추려서 보여줍니다.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-right backdrop-blur">
              <p className="text-xs text-white/70">현재 노출</p>
              <p className="mt-1 text-3xl font-bold">{pageData.totalCount}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-white/65">편의점</p>
              <p className="mt-1 text-xl font-semibold">
                {pageData.sourceCounts.convenience}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-white/65">프랜차이즈</p>
              <p className="mt-1 text-xl font-semibold">
                {pageData.sourceCounts.franchise}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-white/60">
            마지막 수집 {formatUpdatedAt(pageData.lastUpdated)}
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">기간</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((option) => {
                const active = option.key === period;
                return (
                  <Link
                    key={option.key}
                    href={buildFilterHref(option.key, source)}
                    className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-500 ring-1 ring-gray-200 hover:text-primary"
                    }`}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900">출처</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((option) => {
                const active = option.key === source;
                return (
                  <Link
                    key={option.key}
                    href={buildFilterHref(period, option.key)}
                    className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-white"
                        : "bg-white text-gray-500 ring-1 ring-gray-200 hover:text-primary"
                    }`}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-8">
          {pageData.products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-12 text-center">
              <p className="text-base font-semibold text-gray-900">
                조건에 맞는 신상이 아직 없습니다
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                기간을 넓히거나 출처 필터를 바꿔보세요. 공식 채널 기준으로 수집합니다.
              </p>
            </div>
          ) : (
            pageData.products.map((product) => (
              <NewProductCard key={product.id} product={product} />
            ))
          )}
        </section>

        <Footer />
      </main>
      <BottomNav />
    </>
  );
}
