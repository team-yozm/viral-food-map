"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchCrawlerHealth, type CrawlerHealthResponse } from "@/lib/crawler";
import { supabase } from "@/lib/supabase";

interface KeywordAliasRow {
  id: string;
  alias: string;
  canonical_keyword: string;
  confidence: number | null;
  source_job: string;
  last_seen_at: string;
  created_at: string;
}

interface AIAutomationUsageRow {
  id: string;
  usage_date: string;
  job_name: string;
  trigger: string;
  created_at: string;
}

type SaveStatus = "idle" | "loading" | "success" | "error";

function cleanDisplayKeyword(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeKeyword(value: string) {
  return cleanDisplayKeyword(value)
    .toLowerCase()
    .replace(/[^0-9a-zA-Z가-힣]+/g, "");
}

function getTodaySeoulDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

export default function AiAliasesTab() {
  const [aliases, setAliases] = useState<KeywordAliasRow[]>([]);
  const [usageRows, setUsageRows] = useState<AIAutomationUsageRow[]>([]);
  const [health, setHealth] = useState<CrawlerHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [aliasInput, setAliasInput] = useState("");
  const [canonicalInput, setCanonicalInput] = useState("");
  const [confidenceInput, setConfidenceInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const today = getTodaySeoulDate();
    const [aliasesResult, usageResult] = await Promise.allSettled([
      supabase
        .from("keyword_aliases")
        .select(
          "id, alias, canonical_keyword, confidence, source_job, last_seen_at, created_at"
        )
        .order("last_seen_at", { ascending: false })
        .limit(200),
      supabase
        .from("ai_automation_usage")
        .select("id, usage_date, job_name, trigger, created_at")
        .eq("usage_date", today)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (aliasesResult.status === "fulfilled" && aliasesResult.value.data) {
      setAliases(aliasesResult.value.data as KeywordAliasRow[]);
    }

    if (usageResult.status === "fulfilled" && usageResult.value.data) {
      setUsageRows(usageResult.value.data as AIAutomationUsageRow[]);
    }

    setLoading(false);
    setRefreshing(false);

    void fetchCrawlerHealth()
      .then((result) => {
        setHealth(result);
      })
      .catch(() => {
        setHealth(null);
      });
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const filteredAliases = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return aliases;
    return aliases.filter(
      (row) =>
        row.alias.toLowerCase().includes(trimmed) ||
        row.canonical_keyword.toLowerCase().includes(trimmed)
    );
  }, [aliases, query]);

  const usageByJob = useMemo(() => {
    return usageRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.job_name] = (acc[row.job_name] ?? 0) + 1;
      return acc;
    }, {});
  }, [usageRows]);

  const dailyLimit = health?.daily_ai_limit ?? null;
  const usedToday = usageRows.length;
  const remainingToday =
    dailyLimit === null ? null : Math.max(dailyLimit - usedToday, 0);

  const resetForm = () => {
    setAliasInput("");
    setCanonicalInput("");
    setConfidenceInput("");
  };

  const saveAlias = async () => {
    const alias = cleanDisplayKeyword(aliasInput);
    const canonicalKeyword = cleanDisplayKeyword(canonicalInput);

    if (!alias || !canonicalKeyword) {
      setSaveStatus("error");
      setSaveMessage("별칭과 대표 키워드를 모두 입력해 주세요.");
      return;
    }

    const aliasNormalized = normalizeKeyword(alias);
    const canonicalNormalized = normalizeKeyword(canonicalKeyword);
    if (!aliasNormalized || !canonicalNormalized) {
      setSaveStatus("error");
      setSaveMessage("정규화 가능한 키워드를 입력해 주세요.");
      return;
    }

    const parsedConfidence =
      confidenceInput.trim() === "" ? null : Number(confidenceInput);
    if (
      parsedConfidence !== null &&
      (Number.isNaN(parsedConfidence) ||
        parsedConfidence < 0 ||
        parsedConfidence > 1)
    ) {
      setSaveStatus("error");
      setSaveMessage("confidence는 0~1 범위여야 합니다.");
      return;
    }

    setSaveStatus("loading");
    setSaveMessage(null);

    const { error } = await supabase.from("keyword_aliases").upsert(
      {
        alias,
        alias_normalized: aliasNormalized,
        canonical_keyword: canonicalKeyword,
        canonical_normalized: canonicalNormalized,
        confidence: parsedConfidence,
        source_job: "admin",
        last_seen_at: new Date().toISOString(),
      },
      {
        onConflict: "alias_normalized",
      }
    );

    if (error) {
      setSaveStatus("error");
      setSaveMessage(error.message);
      return;
    }

    setSaveStatus("success");
    setSaveMessage("동의어 매핑을 저장했습니다.");
    resetForm();
    await fetchData(true);
  };

  const loadAlias = (row: KeywordAliasRow) => {
    setAliasInput(row.alias);
    setCanonicalInput(row.canonical_keyword);
    setConfidenceInput(row.confidence === null ? "" : String(row.confidence));
    setSaveStatus("idle");
    setSaveMessage("수정할 매핑을 불러왔습니다.");
  };

  const deleteAlias = async (id: string) => {
    const { error } = await supabase.from("keyword_aliases").delete().eq("id", id);
    if (error) {
      setSaveStatus("error");
      setSaveMessage(error.message);
      return;
    }
    setSaveStatus("success");
    setSaveMessage("동의어 매핑을 삭제했습니다.");
    await fetchData(true);
  };

  if (loading) {
    return <p className="py-12 text-center text-gray-400">로딩 중..</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="mb-1 text-xs text-gray-400">오늘 자동 AI 사용</p>
          <p className="text-2xl font-bold text-gray-900">{usedToday}</p>
          <p className="mt-1 text-xs text-gray-400">스케줄러 자동 실행 기준</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="mb-1 text-xs text-gray-400">일일 한도</p>
          <p className="text-2xl font-bold text-gray-900">
            {dailyLimit === null ? "-" : dailyLimit}
          </p>
          <p className="mt-1 text-xs text-gray-400">crawler /health 기준</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="mb-1 text-xs text-gray-400">남은 호출</p>
          <p className="text-2xl font-bold text-primary">
            {remainingToday === null ? "-" : remainingToday}
          </p>
          <p className="mt-1 text-xs text-gray-400">Asia/Seoul 날짜 기준</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="mb-1 text-xs text-gray-400">등록 alias</p>
          <p className="text-2xl font-bold text-gray-900">{aliases.length}</p>
          <p className="mt-1 text-xs text-gray-400">캐시/수동 등록 포함</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">스케줄/예산 설정</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-400">시간대</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {health?.scheduler_timezone || "배포 반영 대기"}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-400">판매처 갱신 주기</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {health?.store_update_interval_minutes
                    ? `${health.store_update_interval_minutes}분`
                    : "배포 반영 대기"}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-400">트렌드 감지</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {health?.trend_detection_schedule || "배포 반영 대기"}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-400">키워드 발굴</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {health?.keyword_discovery_schedule || "배포 반영 대기"}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => void fetchData(true)}
            disabled={refreshing}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
          >
            {refreshing ? "새로고침 중.." : "새로고침"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">동의어 매핑 추가/수정</h3>
        <p className="mt-1 text-xs text-gray-400">
          같은 alias로 저장하면 기존 매핑을 덮어씁니다.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            type="text"
            value={aliasInput}
            onChange={(event) => setAliasInput(event.target.value)}
            placeholder="별칭 예: 두바이 쫀득쿠키"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <input
            type="text"
            value={canonicalInput}
            onChange={(event) => setCanonicalInput(event.target.value)}
            placeholder="대표명 예: 두쫀쿠"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={confidenceInput}
            onChange={(event) => setConfidenceInput(event.target.value)}
            placeholder="confidence 0~1"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <button
            onClick={() => void saveAlias()}
            disabled={saveStatus === "loading"}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-600 disabled:opacity-50"
          >
            {saveStatus === "loading" ? "저장 중.." : "저장"}
          </button>
        </div>
        {saveMessage && (
          <p
            className={`mt-3 text-xs ${
              saveStatus === "error" ? "text-red-500" : "text-green-600"
            }`}
          >
            {saveMessage}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">동의어 캐시</h3>
            <p className="mt-1 text-xs text-gray-400">
              자동 AI 판정 결과와 수동 등록을 함께 보여줍니다.
            </p>
          </div>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="alias 또는 대표명 검색"
            className="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {filteredAliases.length === 0 ? (
            <p className="py-8 text-center text-gray-400">표시할 alias가 없습니다.</p>
          ) : (
            filteredAliases.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-100 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {row.alias}
                    </span>
                    <span className="text-xs text-gray-300">→</span>
                    <span className="text-sm font-semibold text-primary">
                      {row.canonical_keyword}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                      {row.source_job}
                    </span>
                    {row.confidence !== null && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">
                        {row.confidence.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    마지막 반영 {new Date(row.last_seen_at).toLocaleString("ko-KR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadAlias(row)}
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
                  >
                    불러오기
                  </button>
                  <button
                    onClick={() => void deleteAlias(row.id)}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">오늘 자동 AI 사용 로그</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(usageByJob).length === 0 ? (
            <span className="text-xs text-gray-400">오늘 기록이 없습니다.</span>
          ) : (
            Object.entries(usageByJob).map(([jobName, count]) => (
              <span
                key={jobName}
                className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700"
              >
                {jobName} {count}회
              </span>
            ))
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {usageRows.length === 0 ? (
            <p className="py-8 text-center text-gray-400">
              오늘 자동 AI 사용 기록이 없습니다.
            </p>
          ) : (
            usageRows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{row.job_name}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    trigger={row.trigger} /{" "}
                    {new Date(row.created_at).toLocaleString("ko-KR")}
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                  {row.usage_date}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
