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

/**
 * Flat pixel shades per place: lit top face, front face, shaded edge and the
 * outline colour used around the big numeral. The stage is always a night
 * scene (an arcade screen), so these never have to fight a light theme.
 */
const MEDAL = [
  { top: "#ffe68f", face: "#f5b52a", shade: "#c4840f", dark: "#4a2e02" },
  { top: "#f1f5fb", face: "#b6c2d4", shade: "#7d8ba3", dark: "#232b3a" },
  { top: "#f8b987", face: "#d47b3b", shade: "#9b4e1d", dark: "#3d1c06" },
];
const PLACE_NAME = ["1st", "2nd", "3rd"];
const SUFFIX = ["st", "nd", "rd"];
// Block heights for 1st, 2nd, 3rd, phone then desktop.
const HEIGHT = [
  "h-[9.5rem] sm:h-[11.5rem]",
  "h-[7.5rem] sm:h-[9rem]",
  "h-[6.25rem] sm:h-[7.5rem]",
];
// Blocks rise 3rd, then 2nd, then 1st, for a drumroll.
const RISE_DELAY = [0.45, 0.25, 0.1];
// The list stays in rank order for screen readers and keyboard focus; CSS
// order lays it out 2nd, 1st, 3rd.
const VISUAL_ORDER = ["order-2", "order-1", "order-3"];
const AVATAR = [
  "h-[4.5rem] w-[4.5rem] sm:h-28 sm:w-28",
  "h-14 w-14 sm:h-20 sm:w-20",
  "h-14 w-14 sm:h-20 sm:w-20",
];

const fmt = new Intl.NumberFormat("en-US");

/** A hard pixel outline around text, plus a drop shadow below it. */
const outline = (color: string, px: number) =>
  [
    `-${px}px 0 0 ${color}`,
    `${px}px 0 0 ${color}`,
    `0 -${px}px 0 ${color}`,
    `0 ${px}px 0 ${color}`,
    `${px + 2}px ${px + 2}px 0 rgba(0,0,0,0.45)`,
  ].join(", ");

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
    X: MEDAL[0].face,
    R: "#fb7185",
    B: "#6ba8ff",
    S: MEDAL[0].shade,
  };
  return (
    <svg
      viewBox="0 0 10 7"
      width="50"
      height="35"
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

/** Slowly turning manga-style rays behind the champion. */
function Sunburst() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-[9.25rem] h-0 w-0 sm:top-[10.5rem]"
    >
      <div className="podium-rays" />
    </div>
  );
}

/** Pixel firework bursts: each spark flies out along its own direction. */
const BURSTS = [
  { left: "12%", top: "26%", delay: 0, color: MEDAL[0].top, wide: true },
  { left: "88%", top: "20%", delay: 1.1, color: "#ff7eb6", wide: true },
  { left: "27%", top: "9%", delay: 2.2, color: "#7cf0ff", wide: false },
  { left: "73%", top: "11%", delay: 0.6, color: "#a6ff8f", wide: false },
];
const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  const reach = i % 2 === 0 ? 46 : 30;
  return {
    dx: Math.round(Math.cos(angle) * reach),
    dy: Math.round(Math.sin(angle) * reach),
  };
});

function Fireworks() {
  return (
    <div aria-hidden="true" className="podium-fireworks">
      {BURSTS.map((burst, b) => (
        <span
          key={b}
          className={`podium-burst ${burst.wide ? "" : "hidden sm:block"}`}
          style={{ left: burst.left, top: burst.top }}
        >
          {SPARKS.map((spark, i) => (
            <i
              key={i}
              style={
                {
                  "--dx": `${spark.dx}px`,
                  "--dy": `${spark.dy}px`,
                  "--d": `${burst.delay}s`,
                  background: burst.color,
                } as CSSProperties
              }
            />
          ))}
        </span>
      ))}
    </div>
  );
}

/** Pixel confetti drifting down over the stage. */
const CONFETTI = [
  { left: 5, delay: 0, dur: 5.2, c: MEDAL[0].face },
  { left: 13, delay: 2.1, dur: 6.1, c: "#ff7eb6" },
  { left: 21, delay: 3.8, dur: 4.7, c: "#7cf0ff" },
  { left: 29, delay: 1.2, dur: 5.6, c: MEDAL[0].top },
  { left: 37, delay: 4.4, dur: 6.4, c: "#a6ff8f" },
  { left: 44, delay: 0.6, dur: 4.9, c: "#ff7eb6" },
  { left: 51, delay: 2.9, dur: 5.8, c: MEDAL[0].face },
  { left: 58, delay: 1.7, dur: 6.6, c: "#7cf0ff" },
  { left: 65, delay: 3.3, dur: 5.1, c: MEDAL[1].top },
  { left: 72, delay: 0.9, dur: 6.0, c: "#a6ff8f" },
  { left: 80, delay: 2.5, dur: 5.4, c: MEDAL[0].face },
  { left: 88, delay: 4.0, dur: 6.2, c: "#ff7eb6" },
  { left: 95, delay: 1.5, dur: 5.0, c: MEDAL[2].top },
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
          style={{
            left: `${bit.left}%`,
            background: bit.c,
            animationDelay: `${bit.delay}s`,
            animationDuration: `${bit.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

/** A row of pixel heads behind the podium, with camera flashes going off. */
const FLASHES = [8, 19, 33, 46, 61, 77, 90];

function Crowd() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-12 sm:h-16"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        shapeRendering="crispEdges"
      >
        <defs>
          <pattern
            id="podium-crowd"
            width="36"
            height="64"
            patternUnits="userSpaceOnUse"
          >
            <g fill="#241a52">
              <rect x="2" y="22" width="8" height="8" />
              <rect x="0" y="30" width="12" height="34" />
              <rect x="15" y="14" width="8" height="8" />
              <rect x="13" y="22" width="12" height="42" />
              <rect x="27" y="26" width="8" height="8" />
              <rect x="25" y="34" width="12" height="30" />
            </g>
            <g fill="#33286e">
              <rect x="8" y="36" width="8" height="8" />
              <rect x="6" y="44" width="12" height="20" />
              <rect x="21" y="40" width="8" height="8" />
              <rect x="19" y="48" width="12" height="16" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#podium-crowd)" />
      </svg>
      {FLASHES.map((left, i) => (
        <span
          key={left}
          className="podium-flash"
          style={{ left: `${left}%`, animationDelay: `${(i * 0.83) % 4}s` }}
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
      className={`relative flex min-w-0 flex-1 flex-col items-center justify-end ${VISUAL_ORDER[index]}`}
    >
      <span className="sr-only">{`${PLACE_NAME[index]} place: `}</span>
      <m.div
        data-reveal=""
        initial={{ opacity: 0, y: -36 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring.bouncy, delay: delay + 0.35 }}
        className="flex w-full min-w-0 flex-col items-center px-0.5 pb-3 text-center"
      >
        <div className="flex h-10 items-end">{first && <Crown />}</div>
        <Link
          href={place.profileUrl}
          className="group mt-1 flex w-full min-w-0 flex-col items-center focus-visible:outline-none"
        >
          <span className={`relative ${first ? "podium-aura" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- GitHub avatar, already sized by the URL */}
            <img
              src={place.avatarUrl}
              alt=""
              width={112}
              height={112}
              className={`px-frame relative block bg-[#1d1640] transition-transform duration-200 motion-safe:group-hover:-translate-y-1 ${AVATAR[index]}`}
              style={{ ["--px-c" as string]: medal.face }}
            />
          </span>
          <span
            title={place.username}
            className="podium-plate mt-4 block max-w-full truncate px-3 py-1 font-mono text-[11px] font-bold sm:px-4 sm:text-sm group-hover:brightness-110 group-focus-visible:underline"
            style={{ background: medal.face, color: medal.dark }}
          >
            @{place.username}
          </span>
        </Link>
        {(place.isYou || place.isFollowed) && (
          <span className="mt-2 bg-[var(--accent)] px-1.5 py-0.5 font-pixel text-[10px] uppercase leading-none tracking-[0.1em] text-[#05070f]">
            {place.isYou ? "You" : "Following"}
          </span>
        )}
        {place.tier && (
          <span className="mt-2">
            <TierBadge tier={place.tier} score={place.scoreV2} compact />
          </span>
        )}
      </m.div>

      {/* The block: a lit top face in perspective, a front face with side
          highlights, the big ordinal and an engraved plaque with the score. */}
      <m.div
        data-reveal=""
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ ...spring.smooth, delay }}
        style={{ originY: 1 }}
        className={`flex w-full flex-col ${HEIGHT[index]}`}
      >
        <div
          aria-hidden="true"
          className="h-3 w-full sm:h-4"
          style={{
            background: medal.top,
            clipPath: "polygon(8px 0, calc(100% - 8px) 0, 100% 100%, 0 100%)",
          }}
        />
        <div
          className="flex w-full flex-1 flex-col items-center justify-between pb-3 pt-2 sm:pt-3"
          style={{
            background: medal.face,
            boxShadow: `inset 6px 0 0 0 ${medal.top}, inset -6px 0 0 0 ${medal.shade}, inset 0 -8px 0 0 ${medal.shade}`,
          }}
        >
          <span
            aria-hidden="true"
            className={`font-pixel leading-none text-white ${first ? "text-5xl sm:text-7xl" : "text-4xl sm:text-5xl"}`}
            style={{ textShadow: outline(medal.dark, first ? 4 : 3) }}
          >
            {index + 1}
            <span
              className="ml-0.5 align-top text-[0.36em]"
              style={{ textShadow: outline(medal.dark, 2) }}
            >
              {SUFFIX[index]}
            </span>
          </span>
          <span
            className="mx-2 flex min-w-0 max-w-[calc(100%-1rem)] flex-col items-center bg-[#120c2b] px-2 py-1.5 sm:px-3"
            style={{
              boxShadow: `inset 0 3px 0 0 rgba(0,0,0,0.55), 0 3px 0 0 ${medal.top}`,
            }}
          >
            <span
              className={`font-pixel leading-none tabular-nums ${first ? "text-base sm:text-2xl" : "text-sm sm:text-lg"}`}
              style={{ color: index === 1 ? medal.top : MEDAL[0].top }}
            >
              {place.value}
            </span>
            <span className="mt-1 block font-pixel text-[9px] uppercase leading-none tracking-[0.14em] text-[#a9a3c9]">
              {place.valueLabel}
            </span>
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
          <p className="font-pixel text-sm uppercase text-[#fff6dc]">
            Could this be you?
          </p>
          <p className="mt-1 text-xs text-[#a9a3c9]">
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
        <p className="font-pixel text-sm uppercase text-[#fff6dc]">
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
      <p className="text-center font-pixel text-sm uppercase text-[#fff6dc]">
        <span style={{ color: MEDAL[0].top }}>You&apos;re #{chase.rank}</span>{" "}
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
      <p className="font-pixel text-sm uppercase text-[#fff6dc]">
        <span className="text-[var(--accent)]">You</span> · #
        {fmt.format(chase.rank)}
      </p>
      <div
        role="meter"
        aria-label="Progress toward third place"
        aria-valuemin={0}
        aria-valuemax={chase.target}
        aria-valuenow={Math.min(chase.value, chase.target)}
        className="grid gap-[3px] bg-[#05030f] p-[3px]"
        style={{ gridTemplateColumns: `repeat(${SEGMENTS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={`h-3 ${i === filled - 1 ? "podium-meter-tip" : ""}`}
            style={{
              background:
                i < filled
                  ? i < SEGMENTS * 0.5
                    ? MEDAL[0].shade
                    : MEDAL[0].face
                  : "#2a2157",
            }}
          />
        ))}
      </div>
      <p className="font-pixel text-xs uppercase text-[#a9a3c9]">
        <span className="text-[#fff6dc]">{fmt.format(gap)}</span> {chase.unit}{" "}
        to #3 ·{" "}
        <a href="#you" className="text-[var(--accent)] hover:underline">
          Find your row
        </a>
      </p>
    </div>
  );
}

/**
 * The top three as an arcade victory screen: a night stage under a marquee
 * of chasing bulbs, rays turning behind the champion, fireworks, confetti
 * and a cheering pixel crowd, with bright blocks 2nd, 1st and 3rd from the
 * left on a finish-line floor. Underneath, the viewer's distance to third
 * place. Everything carries data-reveal and the loops are switched off in
 * globals.css for reduced motion, so it reads correctly at rest.
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
      className="px-frame podium-stage relative mb-8 overflow-hidden"
      style={{ ["--px-c" as string]: MEDAL[0].shade }}
    >
      <div aria-hidden="true" className="podium-bulbs" />
      <Sunburst />
      <Fireworks />
      <Confetti />

      <header className="relative flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <span className="podium-sign font-pixel text-sm uppercase tracking-[0.12em] sm:text-lg">
          Hall of fame
        </span>
        <span className="truncate font-pixel text-[10px] uppercase tracking-[0.14em] text-[#a9a3c9]">
          {caption}
        </span>
      </header>

      <div className="relative">
        <Crowd />
        <ol className="relative mx-auto flex max-w-3xl items-end gap-1.5 px-2 pt-2 sm:gap-5 sm:px-8">
          {places.slice(0, 3).map((place, i) => (
            <Step key={place.username} place={place} index={i} />
          ))}
        </ol>
      </div>

      {/* Stage floor: a strip of finish-line checks. */}
      <div aria-hidden="true" className="podium-floor relative h-4" />

      <div className="relative bg-[#0a0720] px-4 py-4 sm:px-6">
        <Chase chase={chase} />
      </div>
    </section>
  );
}
