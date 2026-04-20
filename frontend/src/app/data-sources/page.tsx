import type { Metadata } from "next";
import InfoPageLayout from "@/components/InfoPageLayout";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "데이터 출처 안내",
  description:
    "요즘뭐먹에서 사용하는 트렌드 신호, 판매처 데이터, 공식 신상품 데이터의 주요 출처와 한계를 안내합니다.",
  path: "/data-sources",
  keywords: ["데이터 출처", "트렌드 데이터", "공식 신상품 출처"],
});

export default function DataSourcesPage() {
  return (
    <InfoPageLayout
      title="데이터 출처 안내"
      summary="트렌드와 신상품 정보는 공개적으로 확인 가능한 출처를 중심으로 수집하며, 각 출처마다 반영 속도와 한계가 다를 수 있습니다."
      updatedAt="2026년 4월 20일"
    >
      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">트렌드 신호</h2>
        <p className="mt-3">
          검색량 변화, 공개 블로그 문서, 공개 SNS 반응, 영상/게시물 단서처럼 외부에 공개된 신호를
          조합해 음식 키워드의 최근성을 파악합니다. 한 가지 지표만으로 트렌드라고 단정하지는 않습니다.
        </p>
      </section>

      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">판매처 정보</h2>
        <p className="mt-3">
          판매처는 지도 검색 결과와 사용자 제보를 함께 사용합니다. 지도 검색은 최신성을 높이는 데
          도움이 되지만, 실제 영업 상태나 재고 유무까지 보장하지는 않습니다. 사용자 제보는 검수 후에만
          반영합니다.
        </p>
      </section>

      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">신상품 정보</h2>
        <p className="mt-3">
          신상품은 편의점과 프랜차이즈의 공식 메뉴 페이지, 공식 공지, 공식 이벤트/프로모션 페이지처럼
          출처가 명확한 채널을 우선 사용합니다. 공식 출시일이 없는 경우에는 최초 수집 시점과 공개
          시점을 분리해서 해석해야 할 수 있습니다.
        </p>
      </section>

      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">데이터의 한계</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-600">
          <li>매장별 실제 판매 여부와 재고는 시점에 따라 달라질 수 있습니다.</li>
          <li>공식 사이트 구조 변경으로 일부 브랜드는 일시적으로 누락될 수 있습니다.</li>
          <li>출시일이 공개되지 않은 브랜드는 최근 발견 시점이 함께 보일 수 있습니다.</li>
          <li>운영 기준에 따라 품질이 낮은 페이지는 검색 노출을 줄일 수 있습니다.</li>
        </ul>
      </section>
    </InfoPageLayout>
  );
}
