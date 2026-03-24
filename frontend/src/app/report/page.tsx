"use client";

import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ReportForm from "@/components/ReportForm";

export default function ReportPage() {
  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-4">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">판매처 제보하기</h2>
          <p className="text-sm text-gray-500 mt-1">
            유행 음식을 파는 곳을 알고 계신가요? 알려주세요!
          </p>
        </div>
        <ReportForm />
      </main>
      <BottomNav />
    </>
  );
}
