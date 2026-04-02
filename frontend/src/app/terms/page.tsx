import type { Metadata } from "next";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "이용약관",
  description: "요즘뭐먹 서비스 이용 조건과 운영 원칙, 책임 범위를 안내합니다.",
  path: "/terms",
  keywords: ["이용약관", "요즘뭐먹 약관"],
});

export default function TermsPage() {
  return (
    <>
      <Header showBack />
      <main className="page-with-bottom-nav max-w-lg mx-auto px-4 py-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">이용약관</h2>
        <p className="text-xs text-gray-400 mb-6">최종 수정일: 2026년 4월 2일</p>

        <div className="space-y-6 text-sm text-gray-600 leading-relaxed">
          <section>
            <h3 className="font-bold text-gray-800 mb-2">제1조 (목적)</h3>
            <p>본 약관은 요즘뭐먹(yozmeat.com, 이하 "서비스")이 제공하는 SNS 바이럴 음식 트렌드 정보 서비스의 이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">제2조 (서비스 내용)</h3>
            <p>서비스는 다음과 같은 기능을 제공합니다.</p>
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-500">
              <li>SNS 기반 바이럴 음식 트렌드 정보 제공</li>
              <li>트렌드 음식 판매처 위치 지도 서비스</li>
              <li>판매처 제보 접수 및 관리</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">제3조 (서비스 이용)</h3>
            <p>서비스는 별도의 회원가입 없이 누구나 이용할 수 있습니다. 서비스 이용 시 본 약관과 개인정보처리방침에 동의한 것으로 간주합니다. 위치 권한은 선택 사항이며, 허용하지 않아도 주요 탐색 기능은 계속 이용할 수 있습니다.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">제4조 (제보 콘텐츠)</h3>
            <p>이용자가 제보하는 판매처 정보는 서비스 운영을 위해 활용될 수 있으며, 운영자 검토 전에는 공개 반영되지 않습니다. 허위 정보, 권리 침해 가능성이 있는 정보, 중복 정보는 반려되거나 삭제될 수 있습니다.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">제5조 (정보 수정 및 삭제 요청)</h3>
            <p>서비스에 표시된 판매처 정보에 오류가 있거나 삭제가 필요한 경우 이용자는 앱 내 신고 버튼 또는 <a href="mailto:support@yozmeat.com" className="text-primary">support@yozmeat.com</a>을 통해 수정 또는 삭제를 요청할 수 있습니다.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">제6조 (서비스 변경 및 중단)</h3>
            <p>운영자는 서비스의 내용을 변경하거나 중단할 수 있으며, 이 경우 사전 공지를 원칙으로 합니다. 다만 불가피한 경우 사후 공지할 수 있습니다.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">제7조 (면책)</h3>
            <p>서비스에서 제공하는 트렌드 정보 및 판매처 정보는 참고용으로, 실제 운영 여부·메뉴·가격 등은 변경될 수 있습니다. 서비스는 정보의 정확성을 보장하지 않으며, 이용으로 인한 손해에 대해 책임지지 않습니다.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-800 mb-2">제8조 (문의)</h3>
            <p>서비스 이용 관련 문의는 <a href="mailto:support@yozmeat.com" className="text-primary">support@yozmeat.com</a>으로 연락하시기 바랍니다.</p>
          </section>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
