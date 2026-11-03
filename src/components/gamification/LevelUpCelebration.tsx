"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { PixelGem } from "@/components/gamification/TierBadge";
import { TIER_STYLE } from "@/lib/gamification/tier-palette";
import { tierRank, type Tier } from "@/lib/gamification/scoring";
import { spring } from "@/lib/motion";

interface Seen {
  level: number | null;
  tier: Tier;
}

export type Celebration =
  | { kind: "tier"; from: Tier; to: Tier }
  | { kind: "level"; from: number; to: number };

/**
 * What changed since the last visit worth celebrating. A tier-up outranks a
 * level-up; nothing is celebrated on the very first visit.
 */
export function celebrationFor(
  previous: Seen | null,
  now: Seen
): Celebration | null {
  if (!previous) return null;
  if (tierRank(now.tier) > tierRank(previous.tier)) {
    return { kind: "tier", from: previous.tier, to: now.tier };
  }
  if (
    now.level !== null &&
    previous.level !== null &&
    now.level > previous.level
  ) {
    return { kind: "level", from: previous.level, to: now.level };
  }
  return null;
}

const CONFETTI = [
  "#f2c14e",
  "#4fd1c5",
  "#7aa2ff",
  "#c77dff",
  "#fb7185",
  "#4ade80",
];
const DISMISS_MS = 7000;

function storageKey(login: string) {
  return `devtrack:progress:${login.toLowerCase()}`;
}

/**
 * "LEVEL UP!" when the player's level or tier has gone up since this browser
 * last saw them. The last-seen values live in localStorage: it's a
 * per-browser nicety, and a missed celebration costs nothing.
 */
export default function LevelUpCelebration({
  login,
  level,
  tier,
}: {
  login: string;
  level: number | null;
  tier: Tier;
}) {
  const reduceMotion = useReducedMotion();
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  useEffect(() => {
    let previous: Seen | null = null;
    try {
      const raw = window.localStorage.getItem(storageKey(login));
      if (raw) previous = JSON.parse(raw) as Seen;
    } catch {
      previous = null;
    }
    const found = celebrationFor(previous, { level, tier });
    try {
      window.localStorage.setItem(
        storageKey(login),
        JSON.stringify({ level, tier })
      );
    } catch {
      // Storage blocked: no celebration memory, which is fine.
    }
    if (!found) return;
    setCelebration(found);
    const timer = window.setTimeout(() => setCelebration(null), DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [login, level, tier]);

  const style =
    TIER_STYLE[celebration?.kind === "tier" ? celebration.to : tier];

  // Centred by a flex wrapper: the animated element's transform would
  // override a translate-based centring.
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex justify-center px-4">
      <AnimatePresence>
        {celebration && (
          <m.div
            key="level-up"
            role="status"
            aria-live="polite"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: -40, scale: 0.8 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={reduceMotion ? { duration: 0.15 } : spring.bouncy}
            className="pointer-events-auto w-full max-w-[26rem]"
          >
            <div
              className="px-frame px-scanlines relative bg-[var(--card)] p-5 text-center"
              style={{ ["--px-c" as string]: style.accent }}
            >
              {!reduceMotion &&
                Array.from({ length: 24 }, (_, i) => {
                  const angle = (i / 24) * Math.PI * 2;
                  const distance = 90 + (i % 4) * 30;
                  return (
                    <m.span
                      key={i}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2"
                      style={{ background: CONFETTI[i % CONFETTI.length] }}
                      initial={{ x: 0, y: 0, opacity: 1 }}
                      animate={{
                        x: Math.cos(angle) * distance,
                        y: Math.sin(angle) * distance + 40,
                        opacity: 0,
                        rotate: 90 * (i % 3),
                      }}
                      transition={{
                        duration: 1.1,
                        ease: "easeOut",
                        delay: 0.15,
                      }}
                    />
                  );
                })}

              <button
                type="button"
                onClick={() => setCelebration(null)}
                aria-label="Dismiss"
                className="absolute right-2 top-2 p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>

              <p className="font-pixel text-3xl uppercase leading-none text-[var(--card-foreground)]">
                {celebration.kind === "tier" ? "Tier up!" : "Level up!"}
              </p>

              {celebration.kind === "tier" ? (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <PixelGem color={style.accent} shine={style.gem} size={36} />
                  <span
                    className="font-pixel text-xl uppercase"
                    style={{
                      color: `color-mix(in srgb, ${style.accent} 75%, var(--card-foreground))`,
                    }}
                  >
                    {style.label}
                  </span>
                </div>
              ) : (
                <p className="mt-4 font-pixel text-xl tabular-nums text-[var(--card-foreground)]">
                  LV {celebration.from}{" "}
                  <span className="text-[var(--accent)]">→</span> LV{" "}
                  {celebration.to}
                </p>
              )}

              <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                {celebration.kind === "tier"
                  ? `You reached ${style.label} tier. Flex it in your README.`
                  : "Your commits, PRs and reviews just paid off."}
              </p>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
