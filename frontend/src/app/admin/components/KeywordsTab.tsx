"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface KeywordRow {
  id: string;
  keyword: string;
  category: string;
  is_active: boolean;
  last_checked: string | null;
  baseline_volume: number;
  created_at: string;
}

const CATEGORIES = ["디저트", "음료", "식사", "간식"];

export default function KeywordsTab() {
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);

  const fetchKeywords = async () => {
    const { data } = await supabase
      .from("keywords")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setKeywords(data as KeywordRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchKeywords();
  }, []);

  const addKeyword = async () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;

    await supabase.from("keywords").insert({
      keyword: trimmed,
      category: newCategory,
      is_active: true,
      baseline_volume: 0,
    });

    setNewKeyword("");
    await fetchKeywords();
  };

  const toggleActive = async (kw: KeywordRow) => {
    setKeywords((prev) =>
      prev.map((k) => (k.id === kw.id ? { ...k, is_active: !k.is_active } : k))
    );

    const { error } = await supabase
      .from("keywords")
      .update({ is_active: !kw.is_active })
      .eq("id", kw.id);

    if (error) {
      setKeywords((prev) =>
        prev.map((k) => (k.id === kw.id ? { ...k, is_active: kw.is_active } : k))
      );
    }
  };

  const deleteKeyword = async (id: string) => {
    await supabase.from("keywords").delete().eq("id", id);
    await fetchKeywords();
  };

  if (loading) {
    return <p className="text-center text-gray-400 py-12">로딩 중...</p>;
  }

  const categoryColor: Record<string, string> = {
    디저트: "bg-pink-100 text-pink-600",
    음료: "bg-blue-100 text-blue-600",
    식사: "bg-orange-100 text-orange-600",
    간식: "bg-yellow-100 text-yellow-700",
  };

  return (
    <div>
      {/* 추가 폼 */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addKeyword()}
            placeholder="새 키워드 입력..."
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={addKeyword}
            disabled={!newKeyword.trim()}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
          >
            추가
          </button>
        </div>
      </div>

      {/* 키워드 목록 */}
      <div className="flex flex-col gap-2">
        {keywords.length === 0 ? (
          <p className="text-center text-gray-400 py-12">등록된 키워드가 없습니다</p>
        ) : (
          keywords.map((kw) => (
            <div
              key={kw.id}
              className="bg-white rounded-xl p-3 border border-gray-100 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm text-gray-900">{kw.keyword}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    categoryColor[kw.category] || "bg-gray-100 text-gray-500"
                  }`}
                >
                  {kw.category}
                </span>
                {kw.last_checked && (
                  <span className="text-xs text-gray-300">
                    {new Date(kw.last_checked).toLocaleDateString("ko-KR")}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* 토글 스위치 */}
                <button
                  onClick={() => toggleActive(kw)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    kw.is_active ? "bg-green-500" : "bg-gray-300"
                  }`}
                  title={kw.is_active ? "활성" : "비활성"}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      kw.is_active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>

                <button
                  onClick={() => deleteKeyword(kw.id)}
                  className="px-2 py-1 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
