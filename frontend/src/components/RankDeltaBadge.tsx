import type { Trend } from "@/lib/types";

function UpArrow() {
  return (
    <svg width={9} height={9} viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
      <path d="M12 5l8 10H4z" />
    </svg>
  );
}

function DownArrow() {
  return (
    <svg width={9} height={9} viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
      <path d="M12 19L4 9h16z" />
    </svg>
  );
}

const pillBase =
  "inline-flex items-center gap-[2px] rounded-full px-1.5 py-[2px] font-mono text-[9.5px] font-bold";

type Delta =
  | { type: "new" }
  | { type: "up" }
  | { type: "down" };

function calcDelta(trend: Pick<Trend, "previous_rank">, currentRank: number): Delta {
  const prev = trend.previous_rank;
  if (prev == null) return { type: "new" };
  if (prev > currentRank) return { type: "up" };
  if (prev < currentRank) return { type: "down" };
  return { type: "up" };
}

interface RankDeltaBadgeProps {
  trend: Pick<Trend, "previous_rank">;
  currentRank: number;
}

export default function RankDeltaBadge({ trend, currentRank }: RankDeltaBadgeProps) {
  const delta = calcDelta(trend, currentRank);

  if (delta.type === "new") {
    return (
      <span className={`${pillBase} bg-accent-soft text-accent`}>
        NEW
      </span>
    );
  }
  if (delta.type === "up") {
    return (
      <span
        className={`${pillBase} text-pos`}
        style={{ background: "rgba(27,138,90,0.10)" }}
      >
        <UpArrow />
      </span>
    );
  }
  if (delta.type === "down") {
    return (
      <span
        className={`${pillBase} text-neg`}
        style={{ background: "rgba(217,60,60,0.10)" }}
      >
        <DownArrow />
      </span>
    );
  }
}
