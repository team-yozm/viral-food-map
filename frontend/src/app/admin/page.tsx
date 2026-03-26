import type { Metadata } from "next";
import AdminPageClient from "./AdminPageClient";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "관리자",
  description: "요즘뭐먹 관리자 페이지",
  path: "/admin",
  noIndex: true,
});

export default function AdminPage() {
  return <AdminPageClient />;
}
