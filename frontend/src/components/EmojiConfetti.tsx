"use client";

import { useEffect, useRef, useState } from "react";

const FOOD_EMOJIS = [
  "🍜",
  "🍕",
  "🍔",
  "🍗",
  "🍣",
  "🍰",
  "🌮",
  "🥟",
  "🍙",
  "🍟",
];

const BURST_EMOJIS = ["✨", "💜", "🔥", "⭐", "🎉", "🎊"];

const BASE_LIFETIME_MS = 2100;
const MAX_DELAY_MS = 220;
const SIDE_GRAVITY = 1120;

type ConfettiVariant = "reveal" | "share";
type ParticleKind = "emoji" | "sparkle";

interface EmojiConfettiProps {
  fire: boolean;
  variant?: ConfettiVariant;
}

interface ParticleModel {
  id: number;
  emoji: string;
  kind: ParticleKind;
  originX: number;
  originY: number;
  velocityX: number;
  velocityY: number;
  gravity: number;
  rotationStart: number;
  angularVelocity: number;
  size: number;
  delayMs: number;
  lifetimeMs: number;
  wobbleAmplitude: number;
  wobbleFrequency: number;
  wobblePhase: number;
  scaleStart: number;
  scaleEnd: number;
}

interface ParticleFrame {
  id: number;
  emoji: string;
  kind: ParticleKind;
  x: number;
  y: number;
  rotation: number;
  size: number;
  opacity: number;
  scale: number;
}

let particleId = 0;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function createParticle(
  particle: Omit<ParticleModel, "id">
): ParticleModel {
  return {
    id: particleId++,
    ...particle,
  };
}

function generateSideBurst(
  width: number,
  height: number,
  variant: ConfettiVariant
): ParticleModel[] {
  const count = variant === "reveal" ? 28 : 20;
  const half = Math.floor(count / 2);

  return Array.from({ length: count }, (_, index) => {
    const fromLeft = index < half;
    const horizontalDirection = fromLeft ? 1 : -1;
    const origin = {
      x: fromLeft
        ? width * (0.05 + Math.random() * 0.08)
        : width * (0.87 + Math.random() * 0.08),
      y: height * (0.78 + Math.random() * 0.1),
    };

    return createParticle({
      emoji: randomFrom(index % 4 === 0 ? BURST_EMOJIS : FOOD_EMOJIS),
      kind: index % 4 === 0 ? "sparkle" : "emoji",
      originX: origin.x,
      originY: origin.y,
      velocityX: horizontalDirection * (190 + Math.random() * 300),
      velocityY: -(620 + Math.random() * 300),
      gravity: SIDE_GRAVITY + Math.random() * 160,
      rotationStart: (Math.random() - 0.5) * 80,
      angularVelocity: horizontalDirection * (260 + Math.random() * 560),
      size: 0.95 + Math.random() * 0.96,
      delayMs: 110 + Math.random() * MAX_DELAY_MS,
      lifetimeMs: BASE_LIFETIME_MS + Math.random() * 620,
      wobbleAmplitude: 12 + Math.random() * 28,
      wobbleFrequency: 5 + Math.random() * 3,
      wobblePhase: Math.random() * Math.PI * 2,
      scaleStart: 0.68,
      scaleEnd: 1,
    });
  });
}

function generateParticles(
  width: number,
  height: number,
  variant: ConfettiVariant
): ParticleModel[] {
  return generateSideBurst(width, height, variant);
}

function getOpacity(progress: number) {
  if (progress <= 0.08) {
    return progress / 0.08;
  }

  if (progress >= 0.72) {
    return 1 - (progress - 0.72) / 0.28;
  }

  return 1;
}

function getScale(particle: ParticleModel, progress: number) {
  const popProgress = clamp(progress / 0.18, 0, 1);
  const settleProgress = clamp((progress - 0.18) / 0.82, 0, 1);
  const popped =
    particle.scaleStart + (particle.scaleEnd - particle.scaleStart) * popProgress;

  return popped - settleProgress * 0.12;
}

function buildFrame(
  particle: ParticleModel,
  elapsedMs: number
): ParticleFrame | null {
  const activeMs = elapsedMs - particle.delayMs;

  if (activeMs < 0) {
    return {
      id: particle.id,
      emoji: particle.emoji,
      kind: particle.kind,
      x: particle.originX,
      y: particle.originY,
      rotation: particle.rotationStart,
      size: particle.size,
      opacity: 0,
      scale: particle.scaleStart,
    };
  }

  if (activeMs > particle.lifetimeMs) {
    return null;
  }

  const elapsedSeconds = activeMs / 1000;
  const progress = clamp(activeMs / particle.lifetimeMs, 0, 1);
  const wobble =
    Math.sin(
      particle.wobblePhase + elapsedSeconds * particle.wobbleFrequency
    ) * particle.wobbleAmplitude * (1 - progress * 0.35);

  return {
    id: particle.id,
    emoji: particle.emoji,
    kind: particle.kind,
    x: particle.originX + particle.velocityX * elapsedSeconds + wobble,
    y:
      particle.originY +
      particle.velocityY * elapsedSeconds +
      0.5 * particle.gravity * elapsedSeconds * elapsedSeconds,
    rotation: particle.rotationStart + particle.angularVelocity * elapsedSeconds,
    size: particle.size,
    opacity: clamp(getOpacity(progress), 0, 1),
    scale: getScale(particle, progress),
  };
}

export default function EmojiConfetti({
  fire,
  variant = "reveal",
}: EmojiConfettiProps) {
  const [frames, setFrames] = useState<ParticleFrame[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!fire || typeof window === "undefined") {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setFrames([]);
      return;
    }

    const particles = generateParticles(
      window.innerWidth,
      window.innerHeight,
      variant
    );
    const startedAt = performance.now();

    const tick = (now: number) => {
      const elapsedMs = now - startedAt;
      const nextFrames = particles
        .map((particle) => buildFrame(particle, elapsedMs))
        .filter((particle): particle is ParticleFrame => particle !== null);

      setFrames(nextFrames);

      if (nextFrames.length > 0) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    setFrames(
      particles.map((particle) => ({
        id: particle.id,
        emoji: particle.emoji,
        kind: particle.kind,
        x: particle.originX,
        y: particle.originY,
        rotation: particle.rotationStart,
        size: particle.size,
        opacity: 0,
        scale: particle.scaleStart,
      }))
    );

    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [fire, variant]);

  if (frames.length === 0) {
    return null;
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[90] overflow-hidden"
    >
      {frames.map((particle) => (
        <span
          key={particle.id}
          className="absolute left-0 top-0 select-none will-change-transform"
          style={{
            filter:
              particle.kind === "sparkle"
                ? "drop-shadow(0 0 10px rgba(255,255,255,0.62))"
                : "drop-shadow(0 8px 18px rgba(17,24,39,0.24))",
            fontSize: `${particle.size}rem`,
            opacity: particle.opacity,
            transform: `translate3d(${particle.x}px, ${particle.y}px, 0) translate(-50%, -50%) rotate(${particle.rotation}deg) scale(${particle.scale})`,
          }}
        >
          {particle.emoji}
        </span>
      ))}
    </div>
  );
}
