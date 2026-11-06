"use client";

import { m } from "motion/react";
import type { Tier } from "@/lib/gamification/scoring";
import { spring } from "@/lib/motion";
import { TIER_STYLE } from "./tier-style";

/** 7x7 pixel gem, drawn as crisp squares so it matches the pixel cursors. */
const GEM = [
  "..XXX..",
  ".XHHXX.",
  "XHHXXXX",
  "XXXXXXX",
  ".XXXXX.",
  "..XXX..",
  "...X...",
];

export function PixelGem({
  color,
  shine,
  size = 10,
}: {
  color: string;
  shine: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 7 7"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="shrink-0"
    >
      {GEM.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === "." ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              fill={c === "H" ? shine : color}
            />
          )
        )
      )}
    </svg>
  );
}

interface TierBadgeProps {
  tier: Tier;
  score?: number;
  /** Hide the word below `sm`, leaving just the gem. */
  compact?: boolean;
  className?: string;
}

/**
 * A tier "medal". Pops in with a small spring the first time it scrolls into
 * view; carries data-reveal so reduced motion shows it at rest.
 */
export default function TierBadge({
  tier,
  score,
  compact = false,
  className = "",
}: TierBadgeProps) {
  const style = TIER_STYLE[tier];
  const title =
    score === undefined
      ? `${style.label} tier`
      : `${style.label} tier · score ${score} / 1000`;

  return (
    <m.span
      data-reveal=""
      title={title}
      aria-label={title}
      initial={{ opacity: 0, scale: 0.6 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={spring.bouncy}
      className={`inline-flex shrink-0 items-center gap-1 rounded-[3px] px-1.5 py-[3px] font-mono text-[10px] font-bold uppercase leading-none tracking-[0.08em] ${
        tier === "legend" ? "tier-legend" : ""
      } ${className}`}
      style={{
        background: style.fill,
        color: style.text,
        border: "1px solid rgba(11, 16, 32, 0.85)",
        boxShadow:
          "inset 1px 1px 0 rgba(255, 255, 255, 0.45), inset -1px -1px 0 rgba(0, 0, 0, 0.22)",
      }}
    >
      <PixelGem color={style.text} shine={style.gem} />
      <span className={compact ? "hidden sm:inline" : undefined}>
        {style.label}
      </span>
    </m.span>
  );
}
