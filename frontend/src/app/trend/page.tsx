import { redirect } from "next/navigation";

// /trend → 홈 트렌드 목록으로 리디렉트
export default function TrendIndexPage() {
  redirect("/");
}
