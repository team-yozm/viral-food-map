import { INSTAGRAM_URL } from "@/lib/site";

const footerLinks = [
  { href: "/about", label: "서비스 소개" },
  { href: "/how-it-works", label: "수집 방식" },
  { href: "/editorial-policy", label: "운영 원칙" },
  { href: "/data-sources", label: "데이터 출처" },
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
];

export default function Footer() {
  return (
    <footer className="mx-auto mt-8 max-w-lg border-t border-gray-100 px-4 py-8 text-center">
      <p className="mb-1 text-sm font-bold text-primary">요즘뭐먹</p>
      <p className="mb-4 text-xs text-gray-400">
        SNS에서 뜨는 음식 트렌드와 내 주변 판매처를 함께 찾는 서비스
      </p>
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noreferrer"
        className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-5 py-2.5 text-sm font-semibold text-primary transition-all hover:border-primary/50 hover:bg-primary/10 hover:shadow-sm"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="shrink-0"
        >
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.17.054 1.97.24 2.43.403a4.088 4.088 0 011.47.957c.453.454.773.898.957 1.47.163.46.35 1.26.404 2.43.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.054 1.17-.24 1.97-.404 2.43a4.088 4.088 0 01-.957 1.47 4.088 4.088 0 01-1.47.957c-.46.163-1.26.35-2.43.404-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.17-.054-1.97-.24-2.43-.404a4.088 4.088 0 01-1.47-.957 4.088 4.088 0 01-.957-1.47c-.163-.46-.35-1.26-.404-2.43C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.054-1.17.24-1.97.404-2.43a4.088 4.088 0 01.957-1.47A4.088 4.088 0 015.063 2.293c.46-.163 1.26-.35 2.43-.404C8.759 1.831 9.139 1.82 12 1.82zM12 0C8.741 0 8.333.014 7.053.072 5.775.13 4.903.333 4.14.63a5.876 5.876 0 00-2.126 1.384A5.876 5.876 0 00.63 4.14C.333 4.903.13 5.775.072 7.053.014 8.333 0 8.741 0 12s.014 3.667.072 4.947c.058 1.278.261 2.15.558 2.913a5.876 5.876 0 001.384 2.126 5.876 5.876 0 002.126 1.384c.763.297 1.635.5 2.913.558C8.333 23.986 8.741 24 12 24s3.667-.014 4.947-.072c1.278-.058 2.15-.261 2.913-.558a5.876 5.876 0 002.126-1.384 5.876 5.876 0 001.384-2.126c.297-.763.5-1.635.558-2.913.058-1.28.072-1.688.072-4.947s-.014-3.667-.072-4.947c-.058-1.278-.261-2.15-.558-2.913a5.876 5.876 0 00-1.384-2.126A5.876 5.876 0 0019.86.63C19.097.333 18.225.13 16.947.072 15.667.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z" />
        </svg>
        인스타그램 보기
      </a>

      <div className="mb-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-400">
        <a
          href="mailto:support@yozmeat.com"
          className="transition-colors hover:text-primary"
        >
          문의하기
        </a>
        {footerLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="transition-colors hover:text-primary"
          >
            {link.label}
          </a>
        ))}
      </div>

      <p className="text-[11px] text-gray-300">
        © 2026 yozmeat.com · All rights reserved
      </p>
    </footer>
  );
}
