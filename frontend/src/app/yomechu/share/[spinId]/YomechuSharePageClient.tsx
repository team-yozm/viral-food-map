"use client";

import { useCallback } from "react";
import Link from "next/link";

import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import ShareButton from "@/components/ShareButton";
import { openExternalUrl } from "@/lib/external-links";
import type { SharedYomechuPlace } from "@/lib/yomechu-server";
import { sendYomechuFeedback } from "@/lib/crawler";

interface YomechuSharePageClientProps {
  spinId: string;
  poolSize: number;
  usedFallback: boolean;
  winners: SharedYomechuPlace[];
}

function WinnerListCard({
  place,
  rank,
  onOpenPlace,
}: {
  place: SharedYomechuPlace;
  rank: number;
  onOpenPlace: (place: SharedYomechuPlace) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenPlace(place)}
      className="w-full rounded-[28px] border border-gray-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-primary/35 hover:bg-primary/5"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-white">
          {rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-keep text-base font-bold text-gray-900">{place.name}</p>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              {place.category_label}
            </span>
            {place.rating ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                평점 {place.rating.toFixed(1)}
              </span>
            ) : null}
          </div>
          <p className="mt-2 break-keep text-sm leading-6 text-gray-600">{place.address}</p>
          {place.trend_names.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {place.trend_names.slice(0, 3).map((trend) => (
                <span
                  key={trend}
                  className="rounded-full bg-secondary/15 px-3 py-1 text-[11px] font-semibold text-slate-700"
                >
                  {trend}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export default function YomechuSharePageClient({
  spinId,
  poolSize,
  usedFallback,
  winners,
}: YomechuSharePageClientProps) {
  const primaryWinner = winners[0] ?? null;

  const handleTrackShare = useCallback(() => {
    if (!primaryWinner) {
      return;
    }

    void sendYomechuFeedback({
      spin_id: spinId,
      place_id: primaryWinner.place_id,
      event_type: "share",
    });
  }, [primaryWinner, spinId]);

  const handleOpenPlace = useCallback(
    (place: SharedYomechuPlace) => {
      void sendYomechuFeedback({
        spin_id: spinId,
        place_id: place.place_id,
        event_type: "open",
        payload: {
          place_url: place.place_url,
          source: "share_page",
        },
      });

      openExternalUrl(place.place_url);
    },
    [spinId]
  );

  if (!primaryWinner) {
    return (
      <>
        <Header showBack />
        <main className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-12">
          <section className="rounded-[32px] border border-gray-200 bg-white px-6 py-8 text-center shadow-sm">
            <p className="text-lg font-bold text-gray-900">추천 결과를 불러오지 못했어요</p>
            <p className="mt-2 break-keep text-sm leading-6 text-gray-600">
              공유된 요메추 결과 정보가 비어 있습니다.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white"
            >
              나도 추천받기
            </Link>
          </section>
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Header showBack />
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-4">
        <section className="rounded-[32px] bg-gradient-to-br from-primary via-[#8f73d6] to-secondary px-6 py-7 text-white shadow-[0_24px_60px_rgba(155,125,212,0.28)]">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-white/88">
            <span className="rounded-full bg-white/18 px-2.5 py-1">
              요메추 추천 {winners.length}곳
            </span>
            <span className="rounded-full bg-white/18 px-2.5 py-1">
              후보 {poolSize}곳
            </span>
            {usedFallback ? (
              <span className="rounded-full bg-white/18 px-2.5 py-1">
                전체 후보 확장
              </span>
            ) : null}
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-white/72">
            YOMECHU SHARE
          </p>
          <h1 className="mt-2 break-keep text-[30px] font-black tracking-[-0.05em] text-white">
            오늘의 1순위는 {primaryWinner.name}
          </h1>
          <p className="mt-3 break-keep text-sm leading-6 text-white/88">
            요메추가 고른 추천 결과예요. 기준 위치 정보는 숨기고, 추천된 매장 정보만
            공유합니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ShareButton
              title={
                winners.length > 1
                  ? `${primaryWinner.name} 포함 ${winners.length}곳 추천 - 요즘뭐먹`
                  : `${primaryWinner.name} 추천 - 요즘뭐먹`
              }
              description={`${primaryWinner.name} 추천 결과를 요즘뭐먹에서 확인해보세요.`}
              shareLabel="재공유"
              onShare={handleTrackShare}
            />
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-white/28 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/10"
            >
              나도 추천받기
            </Link>
          </div>
        </section>

        <section className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
            TOP PICK
          </p>
          <h2 className="mt-2 break-keep text-2xl font-black tracking-[-0.04em] text-gray-900">
            {primaryWinner.name}
          </h2>
          <p className="mt-2 break-keep text-sm leading-6 text-gray-600">
            {primaryWinner.address}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {primaryWinner.category_label}
            </span>
            {primaryWinner.rating ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                평점 {primaryWinner.rating.toFixed(1)}
              </span>
            ) : null}
            {primaryWinner.trend_names.slice(0, 3).map((trend) => (
              <span
                key={trend}
                className="rounded-full bg-secondary/15 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {trend}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => handleOpenPlace(primaryWinner)}
            className="mt-5 w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-black"
          >
            지도에서 보기
          </button>
        </section>

        {winners.length > 1 ? (
          <section className="flex flex-col gap-8">
            <div>
              <h2 className="text-lg font-bold text-gray-900">추천 리스트</h2>
              <p className="mt-1 text-sm text-gray-500">
                1순위를 포함한 전체 추천 결과입니다.
              </p>
            </div>
            <div className="flex flex-col gap-8">
              {winners.map((place, index) => (
                <WinnerListCard
                  key={place.place_id}
                  place={place}
                  rank={index + 1}
                  onOpenPlace={handleOpenPlace}
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <BottomNav />
    </>
  );
}
