"use client";

import { useEffect, useRef, useState } from "react";

const CONFETTI_EMOJIS = [
  "🎉", "🎊", "🥳", "🍔", "🍕", "🍜", "🌮", "🍣",
  "🔥", "⭐", "💜", "✨", "🎶", "🥂", "🍗", "🍰",
];

const PARTICLE_COUNT = 42;
const BASE_LIFETIME_MS = 2200;
const MAX_DELAY_MS = 180;
const GRAVITY = 1180;

interface ParticleModel {
  id: number;
  emoji: string;
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
}

interface ParticleFrame {
  id: number;
  emoji: string;
  x: number;
  y: number;
  rotation: number;
  size: number;
  opacity: number;
}

let particleId = 0;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function generateParticles(width: number, height: number): ParticleModel[] {
  const particles: ParticleModel[] = [];
  const half = Math.floor(PARTICLE_COUNT / 2);

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const fromLeft = index < half;
    const horizontalDirection = fromLeft ? 1 : -1;

    particles.push({
      id: particleId++,
      emoji: CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)],
      originX: fromLeft
        ? width * (0.04 + Math.random() * 0.08)
        : width * (0.88 + Math.random() * 0.08),
      originY: height * (0.86 + Math.random() * 0.08),
      velocityX: horizontalDirection * (220 + Math.random() * 260),
      velocityY: -(760 + Math.random() * 260),
      gravity: GRAVITY + Math.random() * 180,
      rotationStart: (Math.random() - 0.5) * 80,
      angularVelocity: horizontalDirection * (260 + Math.random() * 520),
      size: 1 + Math.random() * 1.1,
      delayMs: Math.random() * MAX_DELAY_MS,
      lifetimeMs: BASE_LIFETIME_MS + Math.random() * 700,
      wobbleAmplitude: 14 + Math.random() * 28,
      wobbleFrequency: 5 + Math.random() * 3,
      wobblePhase: Math.random() * Math.PI * 2,
    });
  }

  return particles;
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

function buildFrame(
  particle: ParticleModel,
  elapsedMs: number
): ParticleFrame | null {
  const activeMs = elapsedMs - particle.delayMs;

  if (activeMs < 0) {
    return {
      id: particle.id,
      emoji: particle.emoji,
      x: particle.originX,
      y: particle.originY,
      rotation: particle.rotationStart,
      size: particle.size,
      opacity: 0,
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
    x: particle.originX + particle.velocityX * elapsedSeconds + wobble,
    y:
      particle.originY +
      particle.velocityY * elapsedSeconds +
      0.5 * particle.gravity * elapsedSeconds * elapsedSeconds,
    rotation: particle.rotationStart + particle.angularVelocity * elapsedSeconds,
    size: particle.size,
    opacity: clamp(getOpacity(progress), 0, 1),
  };
}

export default function EmojiConfetti({ fire }: { fire: boolean }) {
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

    const particles = generateParticles(window.innerWidth, window.innerHeight);
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
        x: particle.originX,
        y: particle.originY,
        rotation: particle.rotationStart,
        size: particle.size,
        opacity: 0,
      }))
    );

    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [fire]);

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
            fontSize: `${particle.size}rem`,
            opacity: particle.opacity,
            transform: `translate3d(${particle.x}px, ${particle.y}px, 0) rotate(${particle.rotation}deg)`,
          }}
        >
          {particle.emoji}
        </span>
      ))}
    </div>
  );
}
