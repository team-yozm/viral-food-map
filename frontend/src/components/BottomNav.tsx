"use client";

import Link from "next/link";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useEffect, type ReactElement } from "react";
import { usePathname, useRouter } from "next/navigation";
import useAppClipExperience from "@/hooks/useAppClipExperience";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  );
}

function SparkIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
    </svg>
  );
}

function MapIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function ReportIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function YomechuMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8.5" cy="9" r="1.4" fill="currentColor" />
      <circle cx="15.5" cy="9" r="1.4" fill="currentColor" />
      <path
        d="M8 15c1 1.2 2.5 1.8 4 1.8s3-.6 4-1.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

type NavItem = {
  href: string;
  label: string;
  Icon: (props: { active: boolean }) => ReactElement;
};

const leftItems: NavItem[] = [
  { href: "/", label: "홈", Icon: HomeIcon },
  { href: "/new", label: "신상", Icon: SparkIcon },
];

const rightItems: NavItem[] = [
  { href: "/map", label: "지도", Icon: MapIcon },
  { href: "/report", label: "제보", Icon: ReportIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isAppClipExperience = useAppClipExperience();

  useEffect(() => {
    if (isAppClipExperience) {
      return;
    }

    [...leftItems, ...rightItems].forEach((item) => {
      if (item.href !== pathname) {
        router.prefetch(item.href);
      }
    });
  }, [isAppClipExperience, pathname, router]);

  if (isAppClipExperience) {
    return null;
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const handleNav = () => {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  };

  const handleFab = () => {
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    const openFn =
      typeof window !== "undefined"
        ? (window as unknown as { __yozmOpenYomechu?: () => void })
            .__yozmOpenYomechu
        : undefined;
    if (openFn) {
      openFn();
    } else {
      router.push("/?openYomechu=1");
    }
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    const shouldReplace = pathname !== "/" || item.href === "/";
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch
        replace={shouldReplace}
        aria-current={active ? "page" : undefined}
        onClick={(event) => {
          if (active) {
            event.preventDefault();
            return;
          }
          handleNav();
        }}
        className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1 transition-colors ${
          active ? "text-ink" : "text-ink4 hover:text-ink"
        }`}
      >
        <item.Icon active={active} />
        <span className="text-[10px] font-semibold tracking-[-0.02em]">
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[60] isolate border-t border-line bg-surface"
      style={{
        height: "calc(var(--bottom-nav-height) + var(--safe-bottom))",
        paddingBottom: "var(--safe-bottom)",
      }}
    >
      <div className="relative mx-auto flex h-[var(--bottom-nav-height)] max-w-lg items-end px-3 pb-1 pt-2">
        {leftItems.map(renderItem)}
        <div className="flex flex-1 items-start justify-center">
          <button
            type="button"
            onClick={handleFab}
            aria-label="요메추 열기"
            className="-translate-y-5 rounded-full bg-ink text-surface shadow-[0_8px_20px_rgba(20,18,26,0.22),0_0_0_4px_#fff] transition-transform active:scale-95"
            style={{ width: 52, height: 52 }}
          >
            <span className="flex h-full w-full items-center justify-center">
              <YomechuMark size={24} />
            </span>
          </button>
        </div>
        {rightItems.map(renderItem)}
      </div>
    </nav>
  );
}
