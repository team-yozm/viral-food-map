import type { Metadata } from "next";
import InfoPageLayout from "@/components/InfoPageLayout";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "트렌드 수집 방식",
  description:
    "요즘뭐먹이 음식 트렌드, 판매처, 공식 신상품 정보를 어떤 기준과 절차로 수집하는지 설명합니다.",
  path: "/how-it-works",
  keywords: ["트렌드 수집 방식", "음식 트렌드 감지", "판매처 수집 기준"],
});

export default function HowItWorksPage() {
  return (
    <InfoPageLayout
      title="트렌드 수집 방식"
      summary="요즘뭐먹은 검색 반응, 공개 웹 문서, 브랜드 공식 채널, 사용자 제보를 조합해 트렌드와 판매처를 업데이트합니다."
      updatedAt="2026년 4월 20일"
    >
      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">1. 트렌드 후보 수집</h2>
        <p className="mt-3">
          먼저 공개 검색 지표와 블로그, SNS, 공개 웹 문서에서 최근 반응이 붙는 음식 키워드를 후보로
          모읍니다. 이 단계에서는 아직 공개 노출 전 후보이기 때문에, 일반적인 단어와 식품이 아닌
          키워드는 되도록 일찍 걸러냅니다.
        </p>
      </section>

      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">2. 자동 검토와 상태 분류</h2>
        <p className="mt-3">
          후보는 검색량 변화, 최근성, 반복 언급량, 카테고리 신호를 함께 보고 점수화합니다. 그 다음
          자동 검토를 통해 음식 키워드인지, 너무 일반적인 단어는 아닌지, 최근 반응이 유지되는지를
          다시 확인합니다.
        </p>
        <p className="mt-3">
          이렇게 정리된 결과는 rising, active, declining 같은 상태로 분류되고, 상태에 따라 공개 페이지
          노출 범위가 달라집니다.
        </p>
      </section>

      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">3. 판매처와 공식 신상 수집</h2>
        <p className="mt-3">
          판매처 정보는 지도 검색과 사용자 제보를 함께 사용합니다. 신상품은 브랜드 공식 웹사이트,
          공식 메뉴 페이지, 공식 이벤트/공지 채널처럼 출처가 분명한 소스만 우선 사용합니다.
        </p>
        <p className="mt-3">
          비공식 블로그나 커뮤니티 글은 참고 신호로 볼 수는 있어도, 공식 신상 페이지의 기본 출처로는
          삼지 않는 방향을 유지합니다.
        </p>
      </section>

      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">4. 공개 페이지에 올리는 기준</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-600">
          <li>설명이 너무 빈약한 페이지는 검색 노출보다 내부 탐색용으로 우선 둡니다.</li>
          <li>판매처 수가 거의 없거나 정보가 약한 트렌드는 색인을 줄일 수 있습니다.</li>
          <li>공식 출처가 불분명한 신상품은 보류하거나 제외합니다.</li>
          <li>사용자 제보는 검수 전 즉시 공개하지 않습니다.</li>
        </ul>
      </section>
    </InfoPageLayout>
  );
}
