"use client";

import { useEffect, useRef, useState } from "react";

interface LoadingStateProps {
  label?: string;
  description?: string;
  fullScreen?: boolean;
  compact?: boolean;
  className?: string;
}

type SnackIconName =
  | "cookie"
  | "donut"
  | "candy"
  | "macaron"
  | "drink"
  | "cake"
  | "icecream"
  | "popcorn"
  | "pretzel"
  | "chips"
  | "chocolate"
  | "waffle";
const SNACK_ICONS: SnackIconName[] = [
  "cookie",
  "cake",
  "candy",
  "macaron",
  "drink",
  "donut",
  "icecream",
  "popcorn",
  "pretzel",
  "chips",
  "chocolate",
  "waffle",
];
const SNACK_CHANGE_INTERVAL_MS = 720;
const SNACK_EXIT_DURATION_MS = 220;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getRandomSnacks() {
  return [...SNACK_ICONS].sort(() => Math.random() - 0.5);
}

function SnackIcon({ name }: { name: SnackIconName }) {
  if (name === "cookie") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <circle cx="32" cy="32" r="21" fill="#C98745" />
        <path
          d="M15.5 36.5c3.8 10 17.7 16 29.8 6.6"
          fill="none"
          stroke="#E2A767"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <circle cx="24" cy="23" r="3.4" fill="#5F351D" />
        <circle cx="39" cy="22" r="2.8" fill="#5F351D" />
        <circle cx="42" cy="36" r="3.5" fill="#5F351D" />
        <circle cx="27" cy="42" r="2.7" fill="#5F351D" />
      </svg>
    );
  }

  if (name === "donut") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <circle cx="32" cy="32" r="22" fill="#D89B58" />
        <path
          d="M11 30c1.6-13.8 16.3-23 30.4-17.5 10.4 4.1 14.8 13 11.6 23.2-6.7-4-10.9 3.8-16.5 1.7-5.5-2.1-8.5-8.4-15.2-3.4-4.1 3-6.5.5-10.3-4z"
          fill="#F2A6C9"
        />
        <circle cx="32" cy="32" r="8" fill="#FAF8FC" />
        <rect x="22" y="20" width="7" height="2.8" rx="1.4" fill="#FFFFFF" transform="rotate(-24 25.5 21.4)" />
        <rect x="38" y="23" width="7" height="2.8" rx="1.4" fill="#6B4FD3" transform="rotate(28 41.5 24.4)" />
        <rect x="30" y="15" width="7" height="2.8" rx="1.4" fill="#F3B64F" transform="rotate(12 33.5 16.4)" />
      </svg>
    );
  }

  if (name === "candy") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <path d="M9 24l12 6v5L9 41l3.2-8.5L9 24z" fill="#8BACD8" />
        <path d="M55 24l-12 6v5l12 6-3.2-8.5L55 24z" fill="#8BACD8" />
        <rect x="19" y="20" width="26" height="25" rx="11" fill="#F3B64F" />
        <path d="M28 20h7L25 45h-7l10-25z" fill="#FFFFFF" opacity="0.7" />
        <path
          d="M40 24c4 3.8 4.2 11.1.6 15.2"
          fill="none"
          stroke="#D98624"
          strokeLinecap="round"
          strokeWidth="3"
        />
      </svg>
    );
  }

  if (name === "macaron") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <path d="M10 32c1.3-12 11.6-19 22-19s20.7 7 22 19H10z" fill="#BFA7F1" />
        <rect x="12" y="29" width="40" height="8" rx="4" fill="#FFFFFF" />
        <path d="M10 36h44c-1.7 9.7-11.3 15-22 15s-20.3-5.3-22-15z" fill="#8BACD8" />
        <path d="M20 32h24" fill="none" stroke="#EEE8FC" strokeLinecap="round" strokeWidth="3" />
      </svg>
    );
  }

  if (name === "drink") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <path d="M23 19h24l-4 36H27L23 19z" fill="#6B4FD3" />
        <path d="M25 19h20l-1.5 10h-17L25 19z" fill="#8BACD8" />
        <path d="M21.5 19h27l1.5-7H20l1.5 7z" fill="#EEE8FC" />
        <path d="M31.5 12c1.3-6.8 5.1-9.4 10.5-9.4" fill="none" stroke="#6B4FD3" strokeLinecap="round" strokeWidth="4" />
        <rect x="29" y="37" width="12" height="5" rx="2.5" fill="#FFFFFF" opacity="0.75" />
      </svg>
    );
  }

  if (name === "icecream") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <path d="M24 31h16L33.5 58h-3L24 31z" fill="#C98745" />
        <path d="M26 37h12M28 45h8" stroke="#E9B36E" strokeLinecap="round" strokeWidth="2.4" />
        <circle cx="25" cy="27" r="10" fill="#BFA7F1" />
        <circle cx="38" cy="27" r="10" fill="#F2A6C9" />
        <circle cx="31.5" cy="18" r="10.5" fill="#EEE8FC" />
        <circle cx="35" cy="16" r="2" fill="#6B4FD3" />
        <circle cx="26" cy="20" r="1.8" fill="#F3B64F" />
      </svg>
    );
  }

  if (name === "popcorn") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <circle cx="20" cy="18" r="7" fill="#FFF3C4" />
        <circle cx="30" cy="14" r="8" fill="#FFFFFF" />
        <circle cx="42" cy="19" r="7.5" fill="#FFF3C4" />
        <circle cx="33" cy="23" r="7" fill="#FFFFFF" />
        <path d="M18 24h30l-4 33H22L18 24z" fill="#F05C5C" />
        <path d="M24 24h6l-1 33h-7l2-33zM37 24h6l1 33h-7l0-33z" fill="#FFFFFF" opacity="0.88" />
        <path d="M20 30h26" stroke="#D93C3C" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  if (name === "pretzel") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <path
          d="M19 47c-8-3-7-15 1-19 8-4 13 6 12 14-1-8 4-18 13-14 9 4 8 16 0 19-8 3-13-4-13-4s-5 7-13 4z"
          fill="none"
          stroke="#B87435"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="8"
        />
        <path d="M18 47h28" stroke="#B87435" strokeLinecap="round" strokeWidth="8" />
        <circle cx="22" cy="28" r="1.8" fill="#FFF3C4" />
        <circle cx="42" cy="28" r="1.8" fill="#FFF3C4" />
        <circle cx="32" cy="44" r="1.8" fill="#FFF3C4" />
      </svg>
    );
  }

  if (name === "chips") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <path d="M20 13h29l-5 45H17L20 13z" fill="#F3B64F" />
        <path d="M20 13h29l-1.2 10H18.8L20 13z" fill="#6B4FD3" />
        <path d="M24 32c4-6 11-6 16 0-3 3-12 5-16 0z" fill="#FFF3C4" />
        <path d="M25 42h13" stroke="#D98624" strokeLinecap="round" strokeWidth="3" />
        <path d="M24 19h18" stroke="#EEE8FC" strokeLinecap="round" strokeWidth="2.5" />
      </svg>
    );
  }

  if (name === "chocolate") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <rect x="16" y="14" width="32" height="42" rx="5" fill="#6B3F24" />
        <path d="M16 27h32M16 40h32M27 14v42M38 14v42" stroke="#8F5A35" strokeWidth="2.5" />
        <path d="M21 19h8M32 32h8M21 45h8" stroke="#B87435" strokeLinecap="round" strokeWidth="2" opacity="0.9" />
        <path d="M44 14l4 9-8-4 4-5z" fill="#EEE8FC" />
      </svg>
    );
  }

  if (name === "waffle") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <rect x="13" y="13" width="38" height="38" rx="10" fill="#D99A57" transform="rotate(8 32 32)" />
        <path d="M21 17l-5 31M33 15l-5 37M45 20l-4 29" stroke="#B87435" strokeLinecap="round" strokeWidth="3" />
        <path d="M17 24l31 5M15 36l36 5" stroke="#B87435" strokeLinecap="round" strokeWidth="3" />
        <circle cx="40" cy="22" r="4" fill="#F3B64F" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
      <path d="M17 48h34l-2.8 8H19.8L17 48z" fill="#D2C2F4" />
      <path d="M19 28h30l2 20H17l2-20z" fill="#F6B95E" />
      <path d="M22 18c4.8-6.8 15.3-8.8 21 0 5 1.1 8.5 4.6 8.5 9.1 0 6.2-5.7 9.8-12.1 7.8-4.4 3.4-11.9 3.4-16.3 0-6.3 1.8-11.6-1.8-11.6-7.8 0-4.6 3.6-8.2 10.5-9.1z" fill="#EEE8FC" />
      <path d="M25 31h14" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeWidth="3" />
      <circle cx="39" cy="20" r="2.5" fill="#6B4FD3" />
    </svg>
  );
}

function SnackCarousel({ compact = false }: { compact?: boolean }) {
  const [snacks, setSnacks] = useState<SnackIconName[]>(SNACK_ICONS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousSnack, setPreviousSnack] = useState<SnackIconName | null>(null);
  const activeIndexRef = useRef(0);
  const exitTimerRef = useRef<number | null>(null);
  const stageSize = compact ? "h-[92px] w-[92px]" : "h-[118px] w-[118px]";
  const viewportSize = compact ? "inset-[9px]" : "inset-[11px]";
  const itemSize = compact ? "h-11 w-11" : "h-14 w-14";

  useEffect(() => {
    const nextSnacks = getRandomSnacks();
    activeIndexRef.current = 0;
    setActiveIndex(0);
    setPreviousSnack(null);
    setSnacks(nextSnacks);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentIndex = activeIndexRef.current;
      const nextIndex = (currentIndex + 1) % snacks.length;

      setPreviousSnack(snacks[currentIndex]);
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);

      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current);
      }

      exitTimerRef.current = window.setTimeout(() => {
        setPreviousSnack(null);
      }, SNACK_EXIT_DURATION_MS);
    }, SNACK_CHANGE_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, [snacks]);

  return (
    <div className={cx("relative", stageSize)} aria-hidden="true">
      <div className="absolute inset-0 rounded-full border border-line2" />
      <div className="snack-loader-spin absolute inset-0 rounded-full border-2 border-transparent border-t-accent/70" />
      <div
        className={cx(
          "absolute overflow-hidden rounded-full border border-line bg-gradient-to-br from-white via-accent-soft to-bg shadow-[inset_0_8px_20px_rgba(255,255,255,0.72),0_12px_28px_rgba(107,79,211,0.16)]",
          viewportSize
        )}
      >
        <div className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-white/70" />
        <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/55 blur-md" />
        {previousSnack ? (
          <div
            key={`previous-${previousSnack}`}
            className={cx(
              "snack-loader-icon-exit absolute left-1/2 top-1/2 drop-shadow-[0_10px_16px_rgba(20,18,26,0.15)]",
              itemSize
            )}
          >
            <SnackIcon name={previousSnack} />
          </div>
        ) : null}
        <div
          key={`active-${activeIndex}-${snacks[activeIndex]}`}
          className={cx(
            "snack-loader-icon-enter absolute left-1/2 top-1/2 drop-shadow-[0_10px_16px_rgba(20,18,26,0.15)]",
            itemSize
          )}
        >
          <SnackIcon name={snacks[activeIndex]} />
        </div>
      </div>
      <span className="snack-loader-spark absolute right-3 top-4 h-2.5 w-2.5 rounded-full bg-[#F3B64F]" />
      <span className="snack-loader-spark absolute bottom-5 left-3 h-2 w-2 rounded-full bg-secondary [animation-delay:450ms]" />
    </div>
  );
}

export default function LoadingState({
  label = "로딩 중입니다",
  description,
  fullScreen = false,
  compact = false,
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        "flex w-full flex-col items-center justify-center text-center",
        fullScreen
          ? "fixed inset-0 z-[90] min-h-[100dvh] bg-ink/10 px-6 backdrop-blur-[2px]"
          : compact
            ? "px-4 py-6"
            : "px-4 py-12",
        className
      )}
    >
      <div
        className={cx(
          "flex flex-col items-center justify-center text-center",
          fullScreen &&
            "w-full max-w-[260px] rounded-2xl border border-line bg-surface/95 px-6 py-7 shadow-[0_18px_48px_rgba(20,18,26,0.16)]"
        )}
      >
        <SnackCarousel compact={compact} />

        <p className="mt-4 text-sm font-bold text-ink">{label}</p>
        {description ? (
          <p className="mt-1 max-w-56 break-keep text-xs leading-5 text-ink4">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
