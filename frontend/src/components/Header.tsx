"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface HeaderProps {
  showBack?: boolean;
  logoMode?: "link" | "launcher";
  onLogoClick?: () => void;
  launcherOpen?: boolean;
  launcher?: ReactNode;
}

export default function Header({
  showBack = false,
  logoMode = "link",
  onLogoClick,
  launcherOpen = false,
  launcher,
}: HeaderProps) {
  const router = useRouter();

  const logo = (
    <img
      src="/logo-title.png"
      alt="요즘뭐먹"
      className="h-11 object-contain"
    />
  );

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur">
      <div className="relative max-w-lg mx-auto px-4 py-3 flex items-center justify-center">
        {showBack ? (
          <button
            onClick={() => router.back()}
            className="absolute left-4 flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-primary"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            뒤로
          </button>
        ) : null}

        {logoMode === "launcher" ? (
          <button
            type="button"
            onClick={onLogoClick}
            aria-expanded={launcherOpen}
            aria-haspopup="dialog"
            className="group flex items-center gap-2"
          >
            {logo}
            <span
              className={`rounded-full border px-2 py-1 text-[10px] font-semibold tracking-[0.14em] transition-colors ${
                launcherOpen
                  ? "border-primary bg-primary text-white"
                  : "border-primary/20 bg-primary/5 text-primary"
              }`}
            >
              요메추
            </span>
          </button>
        ) : (
          <Link href="/">{logo}</Link>
        )}
      </div>
      {launcher}
    </header>
  );
}
