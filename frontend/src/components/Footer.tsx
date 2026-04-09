import { INSTAGRAM_URL } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="mx-auto mt-8 max-w-lg border-t border-gray-100 px-4 py-8 text-center">
      <p className="mb-1 text-sm font-bold text-primary">요즘뭐먹</p>
      <p className="mb-3 text-xs text-gray-400">
        SNS 바이럴 음식 트렌드와 내 주변 판매처를 탐색
      </p>
      <div className="mb-3 flex justify-center gap-4 text-xs text-gray-300">
        <a
          href="mailto:support@yozmeat.com"
          className="transition-colors hover:text-primary"
        >
          문의하기
        </a>
        <span>·</span>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-primary"
        >
          인스타그램
        </a>
        <span>·</span>
        <a href="/terms" className="transition-colors hover:text-primary">
          이용약관
        </a>
        <span>·</span>
        <a href="/privacy" className="transition-colors hover:text-primary">
          개인정보처리방침
        </a>
      </div>
      <p className="text-[11px] text-gray-300">© 2026 yozmeat.com · All rights reserved</p>
    </footer>
  );
}
