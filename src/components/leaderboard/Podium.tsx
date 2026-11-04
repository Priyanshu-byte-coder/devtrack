"use client";

import Link from "next/link";
import { m } from "motion/react";
import TierBadge from "@/components/gamification/TierBadge";
import type { Tier } from "@/lib/gamification/scoring";
import { spring } from "@/lib/motion";

export interface PodiumPlace {
  username: string;
  avatarUrl: string;
  profileUrl: string;
  value: string;
  valueLabel: string;
  tier?: Tier;
  scoreV2?: number;
  isYou: boolean;
}

const MEDAL = ["#f2c14e", "#a9b4c4", "#d9955c"];
// Block heights in rem for 1st, 2nd, 3rd.
const HEIGHT = [9, 6.5, 5];
// Blocks rise 3rd, then 2nd, then 1st, for a drumroll.
const RISE_DELAY = [0.45, 0.25, 0.1];
// The list stays in rank order for screen readers and keyboard focus; CSS
// order lays it out 2nd, 1st, 3rd.
const VISUAL_ORDER = ["order-2", "order-1", "order-3"];
const PLACE_NAME = ["1st", "2nd", "3rd"];

/** 8x5 pixel crown for first place. */
function Crown() {
  const rows = ["X..XX..X", "XX.XX.XX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX"];
  return (
    <svg
      viewBox="0 0 8 5"
      width="32"
      height="20"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rows.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === "X" ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              fill={y === 2 && x % 3 === 1 ? "#fb7185" : MEDAL[0]}
            />
          ) : null
        )
      )}
    </svg>
  );
}

function Step({ place, index }: { place: PodiumPlace; index: number }) {
  const medal = MEDAL[index];
  const delay = RISE_DELAY[index];
  return (
    <li
      className={`flex min-w-0 flex-1 flex-col items-center justify-end ${VISUAL_ORDER[index]}`}
    >
      <span className="sr-only">{`${PLACE_NAME[index]} place: `}</span>
      <m.div
        data-reveal=""
        initial={{ opacity: 0, y: -28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring.bouncy, delay: delay + 0.35 }}
        className="flex w-full min-w-0 flex-col items-center px-1 pb-3 text-center"
      >
        <div className="h-6">{index === 0 && <Crown />}</div>
        <Link
          href={place.profileUrl}
          className="group mt-1 flex w-full min-w-0 flex-col items-center focus-visible:outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- GitHub avatar, already sized by the URL */}
          <img
            src={place.avatarUrl}
            alt=""
            width={72}
            height={72}
            className="px-frame h-14 w-14 bg-[var(--control)] sm:h-[4.5rem] sm:w-[4.5rem]"
            style={{ ["--px-c" as string]: medal }}
          />
          <span className="mt-3 block w-full truncate font-mono text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] group-focus-visible:text-[var(--accent)] group-focus-visible:underline">
            @{place.username}
          </span>
        </Link>
        {place.isYou && (
          <span className="mt-1 font-pixel text-[10px] uppercase text-[var(--accent)]">
            You
          </span>
        )}
        <span className="mt-1 font-pixel text-lg tabular-nums text-[var(--foreground)] sm:text-2xl">
          {place.value}
        </span>
        <span className="font-pixel text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          {place.valueLabel}
        </span>
        {place.tier && (
          <span className="mt-2">
            <TierBadge tier={place.tier} score={place.scoreV2} compact />
          </span>
        )}
      </m.div>

      <m.div
        data-reveal=""
        aria-hidden="true"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ ...spring.smooth, delay }}
        style={{
          height: `${HEIGHT[index]}rem`,
          originY: 1,
          background: `color-mix(in srgb, ${medal} 22%, var(--card))`,
          boxShadow: `inset 0 6px 0 0 color-mix(in srgb, ${medal} 55%, var(--card)), inset 0 -4px 0 0 rgba(0,0,0,0.25)`,
        }}
        className="flex w-full items-start justify-center pt-4"
      >
        <span
          className="font-pixel text-4xl sm:text-5xl"
          style={{
            color: `color-mix(in srgb, ${medal} 70%, var(--foreground))`,
          }}
        >
          {index + 1}
        </span>
      </m.div>
    </li>
  );
}

/**
 * The top three, on a podium: 2nd, 1st, 3rd from the left. The blocks rise
 * one after another and the players drop onto them. Everything carries
 * data-reveal, so reduced motion (and no JavaScript) shows it at rest.
 */
export default function Podium({ places }: { places: PodiumPlace[] }) {
  return (
    <section aria-label="Top three" className="mb-8">
      <ol className="mx-auto flex max-w-2xl items-end gap-2 border-b-4 border-[var(--border)] sm:gap-4">
        {places.slice(0, 3).map((place, i) => (
          <Step key={place.username} place={place} index={i} />
        ))}
      </ol>
    </section>
  );
}
