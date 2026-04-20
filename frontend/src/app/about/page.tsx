import type { Metadata } from "next";
import Link from "next/link";
import InfoPageLayout from "@/components/InfoPageLayout";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "요즘뭐먹 소개",
  description:
    "요즘뭐먹이 어떤 서비스를 제공하는지, 누구를 위해 운영되는지, 어떤 기준으로 정보를 보여주는지 소개합니다.",
  path: "/about",
  keywords: ["요즘뭐먹 소개", "서비스 소개", "음식 트렌드 서비스"],
});

export default function AboutPage() {
  return (
    <InfoPageLayout
      title="요즘뭐먹 소개"
      summary="요즘뭐먹은 지금 사람들이 실제로 많이 찾는 음식 트렌드와, 그 메뉴를 어디에서 먹을 수 있는지 한 번에 보여주기 위해 만든 서비스입니다."
      updatedAt="2026년 4월 20일"
    >
      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">무엇을 해결하려고 만들었나</h2>
        <p className="mt-3">
          SNS에서 자주 보이는 메뉴를 발견해도 실제로 어디서 팔고 있는지 찾기는 번거롭습니다.
          요즘뭐먹은 이 간격을 줄이기 위해 트렌드 감지, 판매처 지도, 공식 신상품 수집을 한
          곳에 모았습니다.
        </p>
        <p className="mt-3">
          단순히 화제가 된 키워드를 나열하는 것이 아니라, 사용자가 지금 먹어볼 수 있는 메뉴와
          매장을 더 빨리 찾도록 돕는 것이 서비스의 핵심 목적입니다.
        </p>
      </section>

      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">어떤 정보를 제공하나</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-600">
          <li>실시간에 가까운 음식 트렌드 목록과 간단한 해설</li>
          <li>트렌드별 판매처 지도와 제보 기반 매장 정보</li>
          <li>편의점과 프랜차이즈의 공식 신상품 아카이브</li>
          <li>운영 기준, 수집 기준, 수정 정책 같은 공개 문서</li>
        </ul>
      </section>

      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">서비스가 하지 않는 일</h2>
        <p className="mt-3">
          요즘뭐먹은 음식 트렌드 탐색과 판매처 탐색을 돕는 정보 서비스입니다. 개별 매장의 실제
          영업 여부, 재고, 가격, 한정 판매 조건까지 보장하지는 않습니다.
        </p>
        <p className="mt-3">
          따라서 방문 전에는 브랜드 공식 채널이나 지도 서비스, 매장 전화 확인을 함께 권장합니다.
          이 점은 <Link href="/editorial-policy" className="font-semibold text-primary">운영 원칙</Link>과{" "}
          <Link href="/data-sources" className="font-semibold text-primary">데이터 출처 안내</Link>
          에도 명시합니다.
        </p>
      </section>

      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-lg font-bold text-gray-900">운영 원칙</h2>
        <p className="mt-3">
          서비스는 자동 수집과 사람이 정한 기준을 함께 사용합니다. 자동화는 후보를 빠르게 모으는
          데 쓰고, 공개 페이지에는 가능한 한 맥락이 있는 설명과 운영 문서를 함께 제공하는 방향을
          유지합니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/how-it-works"
            className="rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary"
          >
            수집 방식 보기
          </Link>
          <Link
            href="/editorial-policy"
            className="rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary"
          >
            운영 원칙 보기
          </Link>
          <Link
            href="/data-sources"
            className="rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary"
          >
            데이터 출처 보기
          </Link>
        </div>
      </section>
    </InfoPageLayout>
  );
}
