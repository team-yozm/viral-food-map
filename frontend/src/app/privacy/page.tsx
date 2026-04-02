import type { Metadata } from "next";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "개인정보처리방침",
  description:
    "요즘뭐먹 서비스의 개인정보 수집 항목, 이용 목적, 보관 기간과 이용자 권리를 안내합니다.",
  path: "/privacy",
  keywords: ["개인정보처리방침", "요즘뭐먹 개인정보"],
});

export default function PrivacyPage() {
  return (
    <>
      <Header showBack />
      <main className="page-with-bottom-nav max-w-lg mx-auto px-4 py-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">개인정보처리방침</h2>
        <p className="text-xs text-gray-400 mb-6">최종 수정일: 2026년 4월 2일</p>

        <div className="space-y-6 text-sm text-gray-600 leading-relaxed">
          <section>
            <h3 className="font-bold text-gray-800 mb-2">1. 수집하는 개인정보</h3>
            <p>요즘뭐먹은 서비스 제공을 위해 다음과 같은 정보 또는 기기 식별 정보를 처리할 수 있습니다.</p>
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-500">
              <li>위치 정보: 사용자가 현재 위치 버튼을 눌렀을 때의 현재 위치 또는 사용자가 직접 선택한 기준 위치</li>
              <li>제보 정보: 판매처명, 주소, 좌표, 메모 등 이용자가 직접 입력하거나 선택한 정보</li>
              <li>서비스 이용 기록: 익명 방문 식별값, 페이지 경로, 리퍼러, 브라우저/기기 정보</li>
              <li>선택적 알림 정보: 웹 푸시 구독 endpoint 및 암호화 키</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">2. 개인정보 수집 및 이용 목적</h3>
            <ul className="space-y-1 list-disc list-inside text-gray-500">
              <li>내 주변 판매처 탐색, 지도 정렬, 요메추 추천 계산</li>
              <li>판매처 제보 검토, 중복 확인, 품질 관리</li>
              <li>서비스 이용 통계 분석 및 오류 대응</li>
              <li>사용자가 동의한 경우 새 트렌드 알림 발송</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">3. 위치 정보 처리</h3>
            <p>위치 정보는 앱 또는 웹에서 사용자가 직접 현재 위치 사용을 요청한 경우에만 처리합니다. 주변 판매처 검색과 요메추 추천 기능을 위해 위치 또는 사용자가 직접 고른 기준 위치가 서버로 전송될 수 있으며, 요메추 추천 품질 개선을 위해 반올림된 좌표와 세션 식별자가 저장될 수 있습니다. 연속적인 백그라운드 위치 추적은 하지 않습니다.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">4. 로컬 저장 정보</h3>
            <p>앱 또는 브라우저에는 익명 방문 식별값, 내가 제보한 내역, 요메추 세션 식별값 등이 저장될 수 있습니다. 이 정보는 서비스 화면 표시와 재방문 편의를 위한 것으로, 사용자는 앱 삭제 또는 브라우저 데이터 삭제를 통해 제거할 수 있습니다.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">5. 개인정보 보유 및 파기</h3>
            <p>제보 정보는 검토 및 운영 목적 달성에 필요한 기간 동안 보관하며, 잘못된 정보 수정 또는 삭제 요청이 접수되면 확인 후 조치합니다. 익명 통계, 알림 구독 정보, 추천 로그는 서비스 운영과 장애 대응에 필요한 범위 내에서 보관 후 파기합니다. 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">6. 외부 서비스와 제3자 처리</h3>
            <p>수집된 정보는 법령에 의한 경우를 제외하고 무단 판매하거나 광고 목적으로 제3자에게 제공하지 않습니다. 다만 서비스는 Supabase, 카카오맵 API, 크롤러/호스팅 인프라 등 외부 서비스를 사용하며, 기능 제공을 위해 필요한 범위의 정보가 해당 서비스에 전달될 수 있습니다.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">7. 이용자 권리</h3>
            <p>이용자는 언제든지 제보한 정보, 본인과 관련된 삭제 요청, 잘못된 판매처 정보 수정 요청을 할 수 있습니다. 요청은 <a href="mailto:support@yozmeat.com" className="text-primary">support@yozmeat.com</a>으로 문의해 주세요.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">8. 개인정보 보호책임자</h3>
            <p>개인정보 관련 문의 및 불만 처리는 아래 연락처로 문의해 주세요.</p>
            <p className="mt-1 text-gray-500">이메일: <a href="mailto:support@yozmeat.com" className="text-primary">support@yozmeat.com</a></p>
          </section>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
