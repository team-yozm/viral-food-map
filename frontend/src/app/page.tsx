"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Trend } from "@/lib/types";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import TrendCard from "@/components/TrendCard";

export default function Home() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrends = async () => {
      const { data } = await supabase
        .from("trends")
        .select("*, stores(count)")
        .in("status", ["rising", "active"])
        .order("peak_score", { ascending: false });

      if (data) {
        const mapped = data.map((t: any) => ({
          ...t,
          store_count: t.stores?.[0]?.count || 0,
        }));
        setTrends(mapped);
      }
      setLoading(false);
    };

    fetchTrends();

    const channel = supabase
      .channel("trends-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trends" },
        () => fetchTrends()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-4">
        <section className="mb-6">
          <div className="bg-gradient-to-r from-primary to-orange-400 rounded-2xl p-5 text-white">
            <h2 className="text-lg font-bold mb-1">지금 뜨는 음식 🔥</h2>
            <p className="text-sm opacity-90">
              SNS에서 바이럴 중인 음식과 판매처를 실시간으로 알려드려요
            </p>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900">트렌드 목록</h3>
            <span className="text-xs text-gray-400">
              {trends.length}개 감지
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-4 animate-pulse h-24"
                />
              ))}
            </div>
          ) : trends.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-medium">아직 감지된 트렌드가 없어요</p>
              <p className="text-sm mt-1">크롤러가 열심히 찾는 중...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trends.map((trend) => (
                <TrendCard key={trend.id} trend={trend} />
              ))}
            </div>
          )}
        </section>
      </main>
      <BottomNav />
    </>
  );
}
