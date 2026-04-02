import type { Metadata } from "next";
import Link from "next/link";

import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import { buildMetadata } from "@/lib/seo";
import {
  SUPPORT_EMAIL,
  buildGeneralSupportMailto,
  buildPrivacyRequestMailto,
} from "@/lib/support";

export const metadata: Metadata = buildMetadata({
  title: "앱 정보 및 정책",
  description:
    "권한 사용 목적, 데이터 처리, 콘텐츠 운영 정책, 문의 채널을 한 곳에서 확인하세요.",
  path: "/info",
  keywords: ["앱 정보", "권한 안내", "콘텐츠 신고", "정책 안내"],
});

const supportMailto = buildGeneralSupportMailto("서비스 문의");
const privacyMailto = buildPrivacyRequestMailto();

export default function InfoPage() {
  return (
    <>
      <Header />
      <main className="page-with-bottom-nav max-w-lg mx-auto px-4 py-6">
        <div className="rounded-3xl bg-gradient-to-br from-purple-500 to-blue-400 px-5 py-6 text-white shadow-sm">
          <p className="text-xs font-semibold tracking-[0.14em] text-white/80">
            APP INFO
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">
            요즘뭐먹 앱 정보
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/85">
            계정 없이 이용할 수 있고, 위치 권한은 사용자가 직접 요청할 때만
            사용합니다. 사용자 제보는 운영 검수 후에만 공개 반영됩니다.
          </p>
        </div>

        <div className="mt-6 space-y-4 text-sm text-gray-600">
          <section
            id="permissions"
            className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm"
          >
            <h3 className="text-base font-bold text-gray-900">권한과 데이터 안내</h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-gray-600">
              <li>위치 권한은 홈, 지도, 상세 화면에서 사용자가 버튼을 눌렀을 때만 요청합니다.</li>
              <li>현재 위치 또는 직접 고른 위치는 주변 판매처 검색과 요메추 추천 계산에만 사용합니다.</li>
              <li>서비스 개선을 위해 익명 방문 식별값, 페이지 경로, 리퍼러, 기기 브라우저 정보가 저장될 수 있습니다.</li>
              <li>웹 푸시 알림은 사용자가 직접 허용한 경우에만 구독 정보가 저장됩니다.</li>
            </ul>
          </section>

          <section
            id="content-policy"
            className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm"
          >
            <h3 className="text-base font-bold text-gray-900">콘텐츠 운영 정책</h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-gray-600">
              <li>판매처 제보는 즉시 공개되지 않으며 운영자가 검토한 뒤에만 지도에 반영합니다.</li>
              <li>허위 정보, 중복 정보, 권리 침해 가능성이 있는 정보는 반영하지 않거나 삭제할 수 있습니다.</li>
              <li>잘못된 매장 정보나 삭제 요청은 앱 안의 신고 버튼 또는 아래 문의 채널로 접수할 수 있습니다.</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/report"
                className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:opacity-90"
              >
                판매처 제보하기
              </Link>
              <a
                href={privacyMailto}
                className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                수정·삭제 요청
              </a>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
            <h3 className="text-base font-bold text-gray-900">문의 및 정책 문서</h3>
            <div className="mt-3 flex flex-col gap-2">
              <a
                href={supportMailto}
                className="rounded-xl border border-gray-200 px-3 py-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50"
              >
                서비스 문의 보내기
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                {SUPPORT_EMAIL}
              </a>
              <Link
                href="/privacy"
                className="rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                개인정보처리방침 보기
              </Link>
              <Link
                href="/terms"
                className="rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                이용약관 보기
              </Link>
            </div>
          </section>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
