"use client";

import { m } from "motion/react";
import { levelFromXp } from "@/lib/gamification/scoring";
import { duration, ease } from "@/lib/motion";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";

/**
 * Level, XP and progress to the next level.
 *
 * The fill is already sized to the real progress; the animation only scales it
 * in from the left. So the at-rest state (reduced motion, no JS, crawlers) is
 * the correct bar, not an empty or full one.
 *
 * The track, not the fill, is what's watched for scrolling into view: at
 * scaleX(0) the fill has no area, and an element with no area never counts
 * as visible, so it would wait forever.
 */
export default function XpBar({
  xp,
  className = "",
}: {
  xp: number;
  className?: string;
}) {
  const { level, current, needed, fraction } = levelFromXp(xp);
  const pct = Math.max(2, Math.round(fraction * 100));

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 font-mono text-xs">
        <span className="font-bold text-[var(--card-foreground)]">
          LV <AnimatedNumber value={level} />
        </span>
        <span className="tabular-nums text-[var(--muted-foreground)]">
          <AnimatedNumber value={xp} /> XP
          <span className="hidden sm:inline">
            {" · "}
            {(needed - current).toLocaleString("en-US")} to LV {level + 1}
          </span>
        </span>
      </div>
      <m.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        role="progressbar"
        aria-label={`Level ${level} progress`}
        aria-valuemin={0}
        aria-valuemax={needed}
        aria-valuenow={current}
        aria-valuetext={`${current} of ${needed} XP to level ${level + 1}`}
        className="h-2.5 overflow-hidden rounded-[3px] border border-[var(--border)] bg-[var(--control)]"
      >
        <m.div
          data-reveal=""
          className="h-full origin-left bg-[var(--accent)]"
          style={{
            width: `${pct}%`,
            boxShadow:
              "inset 0 1px 0 rgba(255, 255, 255, 0.35), inset 0 -1px 0 rgba(0, 0, 0, 0.2)",
          }}
          variants={{
            hidden: { scaleX: 0 },
            visible: {
              scaleX: 1,
              transition: {
                duration: duration.slower,
                ease: ease.out,
                delay: 0.15,
              },
            },
          }}
        />
      </m.div>
    </div>
  );
}
