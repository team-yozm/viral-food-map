"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import ReportForm from "@/components/ReportForm";
import { supabase } from "@/lib/supabase";
import type { Trend } from "@/lib/types";

interface ReportPageClientProps {
  initialTrends: Trend[];
}

interface MyReportEntry {
  id: string;
  store_name: string;
  trend_name: string;
  status: string;
  created_at: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "verified")
    return (
      <span className="rounded-full bg-pos/10 px-2 py-0.5 text-[10.5px] font-semibold text-pos">
        지도 반영됨
      </span>
    );
  if (status === "rejected")
    return (
      <span className="rounded-full bg-line2 px-2 py-0.5 text-[10.5px] font-semibold text-ink4">
        반려
      </span>
    );
  return (
    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-accent-ink">
      검토중
    </span>
  );
}

function MyReports() {
  const [reports, setReports] = useState<MyReportEntry[]>([]);

  useEffect(() => {
    const stored: MyReportEntry[] = JSON.parse(
      localStorage.getItem("my_reports") ?? "[]"
    );
    if (!stored.length) return;
    setReports(stored);

    supabase
      .from("reports")
      .select("id, status")
      .in("id", stored.map((r) => r.id))
      .then(({ data }) => {
        if (!data) return;
        const statusMap = Object.fromEntries(data.map((r) => [r.id, r.status]));
        setReports((prev) =>
          prev.map((r) => ({ ...r, status: statusMap[r.id] ?? r.status }))
        );
      });
  }, []);

  if (!reports.length) return null;

  return (
    <section className="mt-7">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[15px] font-extrabold tracking-[-0.02em] text-ink">
          내 제보 내역
        </h3>
        <span className="font-kicker text-[10px] font-bold text-ink4">
          {reports.length} ENTRIES
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {reports.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-ink">
                {r.store_name}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-ink4">
                {r.trend_name} · {new Date(r.created_at).toLocaleDateString("ko-KR")}
              </p>
            </div>
            <StatusBadge status={r.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ReportPageClient({ initialTrends }: ReportPageClientProps) {
  return (
    <>
      <main className="page-with-bottom-nav mx-auto max-w-lg pb-6">
        <section className="px-5 pb-5 pt-3">
          <div className="font-kicker text-[10px] font-bold text-accent">
            Contribute
          </div>
          <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.03em] text-ink">
            판매처 제보
          </h1>
          <p className="mt-1.5 text-[12.5px] tracking-[-0.01em] text-ink4">
            검수 후 지도에 반영됩니다. 보통 24시간 이내.
          </p>
        </section>

        <div className="px-4">
          <ReportForm initialTrends={initialTrends} />
        </div>

        <div className="mt-4 px-4">
          <div className="rounded-[16px] border border-line2 bg-bg px-4 py-4">
            <div className="font-kicker text-[10px] font-bold text-ink4">
              Before you report
            </div>
            <ul className="mt-2 flex flex-col gap-1.5 text-[12px] leading-[1.5] tracking-[-0.01em] text-ink3">
              <li>· 정확한 매장명과 주소를 입력해주세요</li>
              <li>· 관리자 검토 후 지도에 표시됩니다 (보통 24시간 이내)</li>
              <li>· 이미 등록된 매장 중복 제보는 불필요해요</li>
              <li>· 카카오맵에서 검색되는 매장명으로 입력하면 정확해요</li>
            </ul>
          </div>
        </div>

        <div className="px-4">
          <MyReports />
        </div>
      </main>
      <BottomNav />
    </>
  );
}
