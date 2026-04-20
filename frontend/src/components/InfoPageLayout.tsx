import type { ReactNode } from "react";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

interface InfoPageLayoutProps {
  title: string;
  summary: string;
  updatedAt?: string;
  children: ReactNode;
}

export default function InfoPageLayout({
  title,
  summary,
  updatedAt,
  children,
}: InfoPageLayoutProps) {
  return (
    <>
      <Header showBack />
      <main className="page-with-bottom-nav mx-auto max-w-lg px-4 py-6">
        <section className="rounded-3xl bg-gradient-to-br from-purple-400 to-blue-400 px-6 py-6 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
            Yozmeat Guide
          </p>
          <h1 className="mt-3 text-2xl font-bold leading-tight">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/90">{summary}</p>
          {updatedAt ? (
            <p className="mt-4 text-xs text-white/75">마지막 업데이트: {updatedAt}</p>
          ) : null}
        </section>

        <div className="mt-6 space-y-4 text-sm leading-7 text-gray-700">
          {children}
        </div>

        <Footer />
      </main>
      <BottomNav />
    </>
  );
}
