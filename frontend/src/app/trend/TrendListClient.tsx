"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import { shouldUseUnoptimizedImage } from "@/lib/image-optimization";
import type { Trend } from "@/lib/types";

interface TrendListClientProps {
  initialTrends: (Trend & { store_count?: number })[];
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function StatusBadge({ status }: { status: Trend["status"] }) {
  if (status === "rising") {
    return (
      <span className="shrink-0 rounded bg-accent-soft px-1.5 py-[2px] text-[10px] font-bold text-accent">
        ↑ 상승
      </span>
    );
  }
  if (status === "declining") {
    return (
      <span className="shrink-0 rounded bg-line2 px-1.5 py-[2px] text-[10px] font-bold text-ink4">
        ↓ 하강
      </span>
    );
  }
  return null;
}

function FeaturedCard({ trend, rank }: { trend: Trend & { store_count?: number }; rank: number }) {
  const unoptimized = shouldUseUnoptimizedImage(trend.image_url);
  return (
    <Link
      href={`/trend/${trend.id}`}
      className="relative block w-full overflow-hidden rounded-[20px]"
      style={{ aspectRatio: "16 / 11" }}
    >
      {trend.image_url ? (
        <Image
          src={trend.image_url}
          alt={trend.name}
          fill
          sizes="(max-width: 512px) 100vw, 512px"
          unoptimized={unoptimized}
          className="object-cover"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-hero-top to-accent" />
      )}
      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.72) 100%)" }}
      />
      {/* Top badges */}
      <div className="absolute left-3.5 top-3.5 flex items-center gap-2">
        <span className="font-kicker rounded-[6px] bg-white px-2 py-[3px] text-[10px] font-extrabold text-ink">
          #{rank}
        </span>
        <span
          className="rounded-[6px] px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.06em] text-white"
          style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(10px)" }}
        >
          {trend.status === "rising" ? "RISING" : trend.status === "declining" ? "DECLINING" : "ACTIVE"}
        </span>
      </div>
      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-8">
        <div className="text-[11.5px] font-semibold text-white/80">{trend.category}</div>
        <div className="mt-1 text-[24px] font-extrabold tracking-[-0.03em] text-white">
          {trend.name}
        </div>
        <div className="mt-1.5 text-[12px] text-white/75">
          판매처 {trend.store_count ?? 0}곳 · 인기도 {trend.peak_score}
        </div>
      </div>
    </Link>
  );
}

function RankedRow({
  trend,
  rank,
}: {
  trend: Trend & { store_count?: number };
  rank: number;
  isLast?: boolean;
}) {
  const score = Math.min(Math.max(trend.peak_score || 0, 0), 100);
  const unoptimized = shouldUseUnoptimizedImage(trend.image_url);

  return (
    <Link
      href={`/trend/${trend.id}`}
      className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-bg active:bg-bg"
    >
      <span className="font-kicker w-7 shrink-0 text-[18px] font-bold text-ink3 tabular-nums">
        {String(rank).padStart(2, "0")}
      </span>
      <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-xl bg-bg">
        {trend.image_url ? (
          <Image
            src={trend.image_url}
            alt={trend.name}
            fill
            sizes="52px"
            unoptimized={unoptimized}
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-accent-soft to-bg" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-[-0.02em] text-ink">
            {trend.name}
          </span>
          <StatusBadge status={trend.status} />
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-ink4">
          {trend.category} · 판매처 {trend.store_count ?? 0}곳
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-kicker text-[13px] font-bold text-ink tabular-nums">{score}</span>
        <span className="h-[3px] w-12 overflow-hidden rounded-full bg-line2">
          <span className="block h-full bg-accent" style={{ width: `${score}%` }} />
        </span>
      </div>
    </Link>
  );
}

export default function TrendListClient({ initialTrends }: TrendListClientProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("전체");

  // 카테고리 목록: 데이터에서 동적으로 추출
  const categories = useMemo(() => {
    const cats = Array.from(new Set(initialTrends.map((t) => t.category).filter(Boolean)));
    return ["전체", ...cats];
  }, [initialTrends]);

  const filtered = useMemo(() => {
    let list = initialTrends;
    if (activeCategory !== "전체") {
      list = list.filter((t) => t.category === activeCategory);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [initialTrends, activeCategory, query]);

  const featured = filtered[0] ?? null;
  const rest = filtered.slice(1);

  return (
    <>
      <Header />
      <main className="page-with-bottom-nav mx-auto max-w-lg pb-8">
        {/* Editorial header */}
        <section className="px-5 pb-4 pt-3">
          <div className="font-kicker text-[10px] font-bold text-accent">Trend Index</div>
          <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.03em] text-ink">트렌드</h1>
          <p className="mt-1.5 text-[12.5px] tracking-[-0.01em] text-ink4">
            SNS, 포털 검색, 판매처 데이터로 집계한 주간 순위
          </p>
        </section>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-ink4 focus-within:border-accent focus-within:text-accent">
            <SearchIcon />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="트렌드 이름 검색"
              className="flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink4"
            />
          </div>
        </div>

        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-4 [scrollbar-width:none]">
          {categories.map((cat) => {
            const active = cat === activeCategory;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-semibold tracking-[-0.01em] transition-colors ${
                  active
                    ? "bg-ink text-surface"
                    : "bg-surface text-ink2 ring-1 ring-inset ring-line"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-[14px] font-semibold text-ink3">검색 결과가 없습니다</p>
            <p className="mt-1 text-[12px] text-ink4">다른 키워드나 카테고리를 선택해보세요</p>
          </div>
        ) : (
          <>
            {/* Featured #1 card */}
            {featured && (
              <div className="px-4 pb-3">
                <FeaturedCard trend={featured} rank={initialTrends.indexOf(featured) + 1} />
              </div>
            )}

            {/* Ranked rows */}
            {rest.length > 0 && (
              <div className="mx-4 overflow-hidden rounded-[20px] border border-line bg-surface">
                {rest.map((trend, i) => {
                  const globalRank = initialTrends.indexOf(trend) + 1;
                  const isLast = i === rest.length - 1;
                  return (
                    <div key={trend.id} className={isLast ? "" : "border-b border-line2"}>
                      <RankedRow trend={trend} rank={globalRank} />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </>
  );
}
