"use client";

import { useEffect, useRef, useState } from "react";

const CONFETTI_EMOJIS = [
  "🎉", "🎊", "🥳", "🍔", "🍕", "🍜", "🌮", "🍣",
  "🔥", "⭐", "💜", "✨", "🎶", "🥂", "🍗", "🍰",
];

interface Particle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  rotation: number;
  size: number;
  delay: number;
  duration: number;
}

let particleId = 0;

function generateParticles(count: number): Particle[] {
  const particles: Particle[] = [];
  const half = Math.floor(count / 2);

  for (let i = 0; i < count; i++) {
    const fromLeft = i < half;
    particles.push({
      id: particleId++,
      emoji: CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)],
      x: fromLeft ? 2 + Math.random() * 8 : 90 + Math.random() * 8,
      y: 30 + Math.random() * 40,
      tx: (fromLeft ? 1 : -1) * (60 + Math.random() * 160),
      ty: -(80 + Math.random() * 200),
      rotation: (Math.random() - 0.5) * 720,
      size: 1.1 + Math.random() * 1.2,
      delay: Math.random() * 0.35,
      duration: 1.0 + Math.random() * 0.8,
    });
  }

  return particles;
}

export default function EmojiConfetti({ fire }: { fire: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!fire) {
      return;
    }

    setParticles(generateParticles(36));

    timerRef.current = setTimeout(() => {
      setParticles([]);
    }, 2400);

    return () => {
      clearTimeout(timerRef.current);
    };
  }, [fire]);

  if (particles.length === 0) {
    return null;
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[90] overflow-hidden"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}vw`,
            top: `${p.y}vh`,
            fontSize: `${p.size}rem`,
            opacity: 0,
            animationName: "confetti-burst",
            animationDuration: `${p.duration}s`,
            animationTimingFunction: "ease-out",
            animationDelay: `${p.delay}s`,
            animationFillMode: "forwards",
            "--tx": `${p.tx}px`,
            "--ty": `${p.ty}px`,
            "--rot": `${p.rotation}deg`,
          } as React.CSSProperties}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
