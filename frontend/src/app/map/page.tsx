"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Store, Trend } from "@/lib/types";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import KakaoMap from "@/components/KakaoMap";

export default function MapPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [selectedTrendId, setSelectedTrendId] = useState<string | "all">("all");
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number }>({
    lat: 37.5665,
    lng: 126.978,
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }

    supabase
      .from("trends")
      .select("id, name, category, status")
      .in("status", ["rising", "active"])
      .then(({ data }) => {
        if (data) setTrends(data as Trend[]);
      });

    supabase
      .from("stores")
      .select("*")
      .then(({ data }) => {
        if (data) setStores(data as Store[]);
      });
  }, []);

  const filteredStores =
    selectedTrendId === "all"
      ? stores
      : stores.filter((s) => s.trend_id === selectedTrendId);

  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-4 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedTrendId("all")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedTrendId === "all"
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            전체
          </button>
          {trends.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTrendId(t.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedTrendId === t.id
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        <KakaoMap
          stores={filteredStores}
          center={userLoc}
          level={7}
          className="map-container !h-[calc(100vh-220px)]"
        />

        <p className="text-center text-xs text-gray-400">
          {filteredStores.length}개 판매처 표시 중
        </p>
      </main>
      <BottomNav />
    </>
  );
}
