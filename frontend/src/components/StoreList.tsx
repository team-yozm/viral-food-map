"use client";

import { useEffect } from "react";
import type { Store } from "@/lib/types";

interface StoreListProps {
  stores: Store[];
  selectedStoreId?: string | null;
  onStoreClick?: (storeId: string) => void;
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`text-xs ${
            i < full
              ? "text-yellow-400"
              : i === full && half
                ? "text-yellow-300"
                : "text-gray-200"
          }`}
        >
          ★
        </span>
      ))}
      <span className="text-xs text-gray-500 ml-0.5">{rating.toFixed(1)}</span>
    </div>
  );
}

function getStoreLink(store: Store): string {
  if (store.place_url) return store.place_url;
  return `https://map.naver.com/search/${encodeURIComponent(store.name + " " + store.address)}`;
}

export default function StoreList({
  stores,
  selectedStoreId,
  onStoreClick,
}: StoreListProps) {
  useEffect(() => {
    if (!selectedStoreId) return;
    document
      .getElementById(`store-${selectedStoreId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedStoreId]);

  if (stores.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p className="text-3xl mb-2">📍</p>
        <p className="text-sm">아직 등록된 판매처가 없어요</p>
        <p className="text-xs mt-1">제보 탭에서 알려주세요!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {stores.map((store) => (
        <div
          key={store.id}
          id={`store-${store.id}`}
          onClick={() => onStoreClick?.(store.id)}
          className={`bg-white rounded-xl p-3 border flex items-center gap-3 transition-all cursor-pointer ${
            store.id === selectedStoreId
              ? "ring-2 ring-purple-400 border-purple-300"
              : "border-gray-100"
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-lg flex-shrink-0">
            {store.verified ? "✅" : "📍"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-sm text-gray-900 truncate">
                {store.name}
              </h4>
              <StarRating rating={store.rating} />
            </div>
            <p className="text-xs text-gray-400 truncate">{store.address}</p>
          </div>
          <a
            href={getStoreLink(store)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 text-primary hover:text-purple-700 transition-colors"
            title="상세 보기"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      ))}
    </div>
  );
}
