import type { Metadata } from "next";
import InfoPageLayout from "@/components/InfoPageLayout";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "운영 원칙",
  description:
    "요즘뭐먹이 어떤 기준으로 트렌드와 신상품을 노출하고, 어떤 경우에 수정 또는 제외하는지 공개합니다.",
  path: "/editorial-policy",
  keywords: ["운영 원칙", "편집 원칙", "트렌드 노출 기준"],
});

export default function EditorialPolicyPage() {
  return (
    <InfoPageLayout
      title="운영 원칙"
      summary="자동화가 빠르게 후보를 모으더라도, 공개 페이지는 사용자에게 실제로 도움이 되는 방향으로 다듬는 것을 원칙으로 합니다."
      updatedAt="2026년 4월 20일"
    >
      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">무엇을 우선하나</h2>
        <p className="mt-3">
          요즘뭐먹은 클릭 수보다 정보 품질을 우선합니다. 사용자가 지금 먹어볼 수 있는 메뉴인지,
          판매처를 실제로 찾는 데 도움이 되는지, 출처가 분명한지 여부를 먼저 봅니다.
        </p>
      </section>

      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">노출을 줄이거나 제외하는 경우</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-600">
          <li>음식이 아닌 일반 명사, 장소명, 밈성 키워드만 남는 경우</li>
          <li>공식 출처나 최근 반응이 약해서 현재성 판단이 어려운 경우</li>
          <li>자동 생성 설명만 있고 페이지 자체 맥락이 부족한 경우</li>
          <li>신상품이 아니라 행사상품이나 프로모션 목록으로 판단되는 경우</li>
        </ul>
      </section>

      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">AI와 자동화 사용 범위</h2>
        <p className="mt-3">
          자동화는 후보 수집, 분류, 짧은 설명 초안 작성에 사용될 수 있습니다. 그러나 자동 생성만으로
          페이지 품질을 충분하다고 보지 않으며, 운영 문서와 공개 페이지는 사람이 읽었을 때 맥락이
          드러나도록 보강하는 방향을 유지합니다.
        </p>
      </section>

      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">수정과 문의</h2>
        <p className="mt-3">
          잘못된 판매처, 종료된 신상품, 설명 오류 같은 문제가 있으면 제보나 이메일을 통해 수정 요청을
          받을 수 있습니다. 검토 후 필요하면 노출을 줄이거나 설명을 바로잡습니다.
        </p>
        <p className="mt-3">
          문의: <a href="mailto:support@yozmeat.com" className="font-semibold text-primary">support@yozmeat.com</a>
        </p>
      </section>
    </InfoPageLayout>
  );
}
