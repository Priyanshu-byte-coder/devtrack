"use client";

import type { CSSProperties } from "react";
import Link from "@/components/Link";
import { m } from "motion/react";
import TierBadge from "@/components/gamification/TierBadge";
import type { Tier } from "@/lib/gamification/scoring";
import { spring } from "@/lib/motion";
import { SIGN_IN_HREF } from "@/components/landing/arcade/types";

export interface PodiumPlace {
  username: string;
  avatarUrl: string;
  profileUrl: string;
  value: string;
  valueLabel: string;
  tier?: Tier;
  scoreV2?: number;
  isYou: boolean;
  isFollowed?: boolean;
}

/** Where the viewer stands relative to the podium. */
export type PodiumChase =
  | { kind: "signed-out" }
  | { kind: "off-board" }
  | { kind: "on-podium"; rank: number }
  | {
      kind: "chasing";
      rank: number;
      value: number;
      target: number;
      unit: string;
    };

// Gold, silver, bronze. Mixed toward the theme's text colour wherever they
// colour text, so light themes keep contrast.
const MEDAL = ["#f2c14e", "#b8c4d6", "#d9955c"];
const PLACE_NAME = ["1st", "2nd", "3rd"];
const PLACE_TAG = ["Champion", "2nd", "3rd"];
// Block heights in rem for 1st, 2nd, 3rd.
const HEIGHT = [8.5, 6, 4.5];
// Blocks rise 3rd, then 2nd, then 1st, for a drumroll.
const RISE_DELAY = [0.45, 0.25, 0.1];
// The list stays in rank order for screen readers and keyboard focus; CSS
// order lays it out 2nd, 1st, 3rd.
const VISUAL_ORDER = ["order-2", "order-1", "order-3"];
const AVATAR = [
  "h-20 w-20 sm:h-24 sm:w-24",
  "h-14 w-14 sm:h-[4.5rem] sm:w-[4.5rem]",
  "h-14 w-14 sm:h-[4.5rem] sm:w-[4.5rem]",
];

const ink = (color: string, amount = 70) =>
  `color-mix(in srgb, ${color} ${amount}%, var(--card-foreground))`;
const tint = (color: string, amount: number) =>
  `color-mix(in srgb, ${color} ${amount}%, var(--card))`;

const fmt = new Intl.NumberFormat("en-US");

/** 10x7 pixel crown with three gems, for first place. */
function Crown() {
  const rows = [
    "X...XX...X",
    "XX..XX..XX",
    "XXX.XX.XXX",
    "XXXXXXXXXX",
    "XRXXBXXRXX",
    "XXXXXXXXXX",
    "SSSSSSSSSS",
  ];
  const fill: Record<string, string> = {
    X: MEDAL[0],
    R: "#fb7185",
    B: "#6ba8ff",
    S: "#b5892e",
  };
  return (
    <svg
      viewBox="0 0 10 7"
      width="40"
      height="28"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="podium-crown"
    >
      {rows.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === "." ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              fill={fill[c]}
            />
          )
        )
      )}
    </svg>
  );
}

/**
 * Three stepped spotlight beams from the top of the stage onto the places,
 * drawn as stacked rectangles so the edges stair-step like a sprite.
 */
function Spotlights() {
  // Layout order is 2nd, 1st, 3rd; x positions in a 300-wide viewBox.
  const beams = [
    { from: 132, to: 150, width: 84, color: MEDAL[0], alpha: 11, main: true },
    { from: 112, to: 52, width: 54, color: MEDAL[1], alpha: 6, main: false },
    { from: 188, to: 248, width: 54, color: MEDAL[2], alpha: 6, main: false },
  ];
  const ROWS = 18;
  const H = 180;
  return (
    <svg
      viewBox={`0 0 300 ${H}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[78%] w-full"
    >
      {beams.map((beam, b) => (
        <g
          key={b}
          className={beam.main ? "podium-beam" : undefined}
          fill={`color-mix(in srgb, ${beam.color} ${beam.alpha}%, transparent)`}
        >
          {Array.from({ length: ROWS }, (_, i) => {
            const t = i / (ROWS - 1);
            const center = beam.from + (beam.to - beam.from) * t;
            const width = 10 + (beam.width - 10) * t;
            // Snap to a 4-unit grid so neighbouring rows step, not slope.
            const x = Math.round((center - width / 2) / 4) * 4;
            const w = Math.round(width / 4) * 4;
            return (
              <rect
                key={i}
                x={x}
                y={(i * H) / ROWS}
                width={w}
                height={H / ROWS + 0.5}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
}

/** Pixel confetti drifting down over the stage; hidden for reduced motion. */
const CONFETTI = [
  { left: 8, delay: 0, dur: 5.2, c: MEDAL[0] },
  { left: 17, delay: 2.1, dur: 6.1, c: "var(--accent)" },
  { left: 26, delay: 3.8, dur: 4.7, c: MEDAL[2] },
  { left: 34, delay: 1.2, dur: 5.6, c: "var(--success)" },
  { left: 41, delay: 4.4, dur: 6.4, c: MEDAL[0] },
  { left: 47, delay: 0.6, dur: 4.9, c: "#fb7185" },
  { left: 53, delay: 2.9, dur: 5.8, c: MEDAL[0] },
  { left: 59, delay: 1.7, dur: 6.6, c: "var(--accent)" },
  { left: 66, delay: 3.3, dur: 5.1, c: MEDAL[1] },
  { left: 74, delay: 0.9, dur: 6.0, c: "var(--success)" },
  { left: 83, delay: 2.5, dur: 5.4, c: MEDAL[0] },
  { left: 92, delay: 4.0, dur: 6.2, c: "#fb7185" },
];

function Confetti() {
  return (
    <div
      aria-hidden="true"
      className="podium-confetti pointer-events-none absolute inset-0 overflow-hidden"
    >
      {CONFETTI.map((bit, i) => (
        <span
          key={i}
          style={
            {
              left: `${bit.left}%`,
              background: bit.c,
              animationDelay: `${bit.delay}s`,
              animationDuration: `${bit.dur}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function Step({ place, index }: { place: PodiumPlace; index: number }) {
  const medal = MEDAL[index];
  const delay = RISE_DELAY[index];
  const first = index === 0;
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
        <div className="flex h-8 items-end">
          {first ? (
            <Crown />
          ) : (
            <span
              aria-hidden="true"
              className="font-pixel text-[10px] uppercase tracking-[0.14em]"
              style={{ color: ink(medal, 75) }}
            >
              {PLACE_TAG[index]}
            </span>
          )}
        </div>
        <Link
          href={place.profileUrl}
          className="group mt-1 flex w-full min-w-0 flex-col items-center focus-visible:outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- GitHub avatar, already sized by the URL */}
          <img
            src={place.avatarUrl}
            alt=""
            width={96}
            height={96}
            className={`px-frame bg-[var(--control)] transition-transform duration-200 motion-safe:group-hover:-translate-y-1 ${AVATAR[index]}`}
            style={{ ["--px-c" as string]: medal }}
          />
          <span
            title={place.username}
            className="mt-3 block w-full truncate font-mono text-xs font-semibold sm:text-sm text-[var(--card-foreground)] group-hover:text-[var(--accent)] group-focus-visible:text-[var(--accent)] group-focus-visible:underline"
          >
            @{place.username}
          </span>
        </Link>
        {first && (
          <span
            className="mt-1 whitespace-nowrap font-pixel text-[10px] uppercase tracking-[0.08em] sm:tracking-[0.18em]"
            style={{ color: ink(medal, 62) }}
          >
            <span aria-hidden="true" className="hidden sm:inline">
              ★{" "}
            </span>
            {PLACE_TAG[0]}
            <span aria-hidden="true" className="hidden sm:inline">
              {" "}
              ★
            </span>
          </span>
        )}
        {(place.isYou || place.isFollowed) && (
          <span className="mt-1 font-pixel text-[10px] uppercase tracking-[0.1em] text-[var(--accent)]">
            {place.isYou ? "You" : "Following"}
          </span>
        )}
        <span
          className={`mt-1 font-pixel tabular-nums ${first ? "text-2xl sm:text-4xl" : "text-lg sm:text-2xl"}`}
          style={{
            color: ink(medal, first ? 60 : 50),
            textShadow: `2px 2px 0 ${tint(medal, 30)}`,
          }}
        >
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

      {/* The block: a lit top face, a bricked front with rivets and a big
          numeral, and a shaded base, all flat pixel colour. */}
      <m.div
        data-reveal=""
        aria-hidden="true"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ ...spring.smooth, delay }}
        style={{ height: `${HEIGHT[index]}rem`, originY: 1 }}
        className="flex w-full flex-col"
      >
        <div className="h-3 w-full" style={{ background: tint(medal, 72) }} />
        <div
          className="relative flex w-full flex-1 items-start justify-center pt-3"
          style={{
            background: tint(medal, 26),
            backgroundImage: `repeating-linear-gradient(0deg, transparent 0 22px, ${tint(medal, 34)} 22px 24px)`,
            boxShadow: `inset 4px 0 0 0 ${tint(medal, 40)}, inset -4px 0 0 0 ${tint(medal, 14)}, inset 0 -6px 0 0 color-mix(in srgb, #000 22%, transparent)`,
          }}
        >
          <span
            className="absolute left-2 top-2 h-1.5 w-1.5"
            style={{ background: tint(medal, 70) }}
          />
          <span
            className="absolute right-2 top-2 h-1.5 w-1.5"
            style={{ background: tint(medal, 70) }}
          />
          <span
            className={`font-pixel leading-none ${first ? "text-5xl sm:text-7xl" : "text-4xl sm:text-5xl"}`}
            style={{
              color: ink(medal, 82),
              textShadow: `4px 4px 0 color-mix(in srgb, ${medal} 30%, #000)`,
            }}
          >
            {index + 1}
          </span>
        </div>
      </m.div>
    </li>
  );
}

/** The viewer's line under the podium: what it takes to get up there. */
function Chase({ chase }: { chase: PodiumChase }) {
  if (chase.kind === "signed-out") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-pixel text-sm uppercase text-[var(--card-foreground)]">
            Could this be you?
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Sign in with GitHub to see where you&apos;d land.
          </p>
        </div>
        <a href={SIGN_IN_HREF} className="px-btn px-btn-sm">
          Press start
        </a>
      </div>
    );
  }
  if (chase.kind === "off-board") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-pixel text-sm uppercase text-[var(--card-foreground)]">
          You&apos;re not on the board yet
        </p>
        <Link href="/claim" className="px-btn px-btn-sm">
          Join the board
        </Link>
      </div>
    );
  }
  if (chase.kind === "on-podium") {
    return (
      <p className="text-center font-pixel text-sm uppercase text-[var(--card-foreground)]">
        <span className="text-[var(--accent)]">You&apos;re #{chase.rank}</span>{" "}
        on the podium · defend your spot
      </p>
    );
  }

  const SEGMENTS = 20;
  const filled = Math.round(
    SEGMENTS * Math.min(1, chase.target > 0 ? chase.value / chase.target : 0)
  );
  const gap = Math.max(1, chase.target - chase.value + 1);
  return (
    <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-5">
      <p className="font-pixel text-sm uppercase text-[var(--card-foreground)]">
        <span className="text-[var(--accent)]">You</span> · #
        {fmt.format(chase.rank)}
      </p>
      <div
        role="meter"
        aria-label="Progress toward third place"
        aria-valuemin={0}
        aria-valuemax={chase.target}
        aria-valuenow={Math.min(chase.value, chase.target)}
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${SEGMENTS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className="h-3"
            style={{
              background:
                i < filled
                  ? i === filled - 1
                    ? "var(--accent-secondary)"
                    : "var(--accent)"
                  : "var(--control)",
            }}
          />
        ))}
      </div>
      <p className="font-pixel text-xs uppercase text-[var(--muted-foreground)]">
        <span className="text-[var(--card-foreground)]">{fmt.format(gap)}</span>{" "}
        {chase.unit} to #3 ·{" "}
        <a href="#you" className="text-[var(--accent)] hover:underline">
          Find your row
        </a>
      </p>
    </div>
  );
}

/**
 * The top three on a lit arcade stage: spotlights, pixel confetti and
 * chunky podium blocks, 2nd, 1st and 3rd from the left. Underneath, the
 * viewer's distance to third place. The blocks rise one after another and
 * the players drop onto them; everything carries data-reveal, and the
 * looping effects are switched off in globals.css for reduced motion, so
 * it reads correctly at rest.
 */
export default function Podium({
  places,
  caption,
  chase,
}: {
  places: PodiumPlace[];
  caption: string;
  chase: PodiumChase;
}) {
  return (
    <section
      aria-label="Top three"
      className="px-frame px-scanlines podium-stage relative mb-8 overflow-hidden bg-[var(--card)]"
      style={{ ["--px-c" as string]: tint(MEDAL[0], 55) }}
    >
      <Spotlights />
      <Confetti />

      <header className="relative flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <span
          className="font-pixel text-xs uppercase tracking-[0.18em]"
          style={{ color: ink(MEDAL[0], 80) }}
        >
          ★ Champions
        </span>
        <span className="truncate font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          {caption}
        </span>
      </header>

      <ol className="relative mx-auto flex max-w-3xl items-end gap-2 px-3 pt-4 sm:gap-6 sm:px-8">
        {places.slice(0, 3).map((place, i) => (
          <Step key={place.username} place={place} index={i} />
        ))}
      </ol>

      {/* Stage floor: a strip of checkered pixel tiles. */}
      <div aria-hidden="true" className="podium-floor relative h-5" />

      <div className="relative border-t-4 border-dotted border-[var(--border)] px-4 py-4 sm:px-6">
        <Chase chase={chase} />
      </div>
    </section>
  );
}
