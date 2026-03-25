"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ReportRow {
  id: string;
  trend_id: string;
  store_name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  note: string | null;
  status: string;
  created_at: string;
  trends?: { name: string };
}

type Filter = "all" | "pending" | "verified";

export default function ReportsTab() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const fetchReports = async () => {
    const { data } = await supabase
      .from("reports")
      .select("*, trends(name)")
      .order("created_at", { ascending: false });
    if (data) setReports(data as ReportRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const approveReport = async (report: ReportRow) => {
    await supabase
      .from("reports")
      .update({ status: "verified" })
      .eq("id", report.id);

    if (report.lat && report.lng) {
      await supabase.from("stores").insert({
        trend_id: report.trend_id,
        name: report.store_name,
        address: report.address,
        lat: report.lat,
        lng: report.lng,
        phone: null,
        source: "user_report",
        verified: true,
      });
    }

    await fetchReports();
  };

  const rejectReport = async (report: ReportRow) => {
    await supabase.from("reports").delete().eq("id", report.id);
    await fetchReports();
  };

  if (loading) {
    return <p className="text-center text-gray-400 py-12">로딩 중...</p>;
  }

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);
  const pendingCount = reports.filter((r) => r.status === "pending").length;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {([
          ["all", "전체"],
          ["pending", `대기중 (${pendingCount})`],
          ["verified", "승인됨"],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === key
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12">제보가 없습니다</p>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              className={`bg-white rounded-xl p-4 border ${
                r.status === "pending"
                  ? "border-yellow-200"
                  : "border-gray-100"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {r.status === "pending" ? "대기중" : "승인됨"}
                    </span>
                    <span className="text-xs text-purple-500 font-medium">
                      {r.trends?.name}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">
                    {r.store_name}
                  </h3>
                  <p className="text-sm text-gray-500">{r.address}</p>
                  {r.note && (
                    <p className="text-xs text-gray-400 mt-1">
                      메모: {r.note}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>
                      {new Date(r.created_at).toLocaleString("ko-KR")}
                    </span>
                    <span>
                      좌표: {r.lat && r.lng ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : "없음"}
                    </span>
                  </div>
                </div>

                {r.status === "pending" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => approveReport(r)}
                      disabled={!r.lat || !r.lng}
                      title={!r.lat || !r.lng ? "좌표 없음 – 승인 불가 (거절 처리하세요)" : undefined}
                      className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => rejectReport(r)}
                      className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors"
                    >
                      거절
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
