"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import LoginForm from "./components/LoginForm";
import DashboardTab from "./components/DashboardTab";
import TrendsTab from "./components/TrendsTab";
import KeywordsTab from "./components/KeywordsTab";
import ReportsTab from "./components/ReportsTab";
import StoresTab from "./components/StoresTab";
import YomechuTab from "./components/YomechuTab";
import { supabase } from "@/lib/supabase";

type AdminTab =
  | "dashboard"
  | "trends"
  | "keywords"
  | "reports"
  | "stores"
  | "yomechu";

const TABS: { key: AdminTab; label: string }[] = [
  { key: "dashboard", label: "대시보드" },
  { key: "trends", label: "트렌드" },
  { key: "keywords", label: "키워드" },
  { key: "reports", label: "제보 관리" },
  { key: "stores", label: "판매처 관리" },
  { key: "yomechu", label: "요메추" },
];

export default function AdminPageClient() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("reports")
      .select("id")
      .eq("status", "pending")
      .then(({ data }) => setPendingCount(data?.length ?? 0));
  }, [user, tab]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">요즘뭐먹 Admin</h1>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              setUser(null);
            }}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            로그아웃
          </button>
        </div>
        <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === tabItem.key
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {tabItem.label}
              {tabItem.key === "reports" && pendingCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "trends" && <TrendsTab />}
        {tab === "keywords" && <KeywordsTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "stores" && <StoresTab />}
        {tab === "yomechu" && <YomechuTab />}
      </main>
    </div>
  );
}
