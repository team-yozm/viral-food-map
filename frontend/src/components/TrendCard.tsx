"use client";

import Link from "next/link";
import type { Trend } from "@/lib/types";
import TrendBadge from "./TrendBadge";

interface TrendCardProps {
  trend: Trend;
}

export default function TrendCard({ trend }: TrendCardProps) {
  return (
    <Link href={`/trend/${trend.id}`}>
      <div className="bg-white rounded-2xl p-4 shadow-sm card-hover border border-gray-100">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl">
              {trend.category === "디저트"
                ? "🍪"
                : trend.category === "음료"
                  ? "🥤"
                  : "🍽️"}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{trend.name}</h3>
              <p className="text-xs text-gray-400">{trend.category}</p>
            </div>
          </div>
          <TrendBadge status={trend.status} />
        </div>
        {trend.description && (
          <p className="text-sm text-gray-500 mb-2 line-clamp-2">
            {trend.description}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>📍 판매처 {trend.store_count || 0}곳</span>
          <span>트렌드 점수 {trend.peak_score}</span>
        </div>
      </div>
    </Link>
  );
}
