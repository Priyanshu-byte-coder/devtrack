import Link from "next/link";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { PixelGem } from "@/components/gamification/TierBadge";
import { TIER_STYLE } from "@/lib/gamification/tier-palette";
import type { LandingLeader } from "./types";

const PLACE = ["1ST", "2ND", "3RD", "4TH", "5TH"];
// Medal colours for the podium places, pulled toward the text colour so they
// stay readable on light themes too. The rest use the muted text colour.
const PLACE_COLOR = ["#f2c14e", "#a9b4c4", "#d9955c"].map(
  (c) => `color-mix(in srgb, ${c} 55%, var(--card-foreground))`
);

/**
 * Stands in while the board loads: the same frame and row heights, so the
 * hero doesn't move when the scores arrive.
 */
/** Framed on its own; bare when it sits on the hero cabinet screen. */
const boardClass = (bare: boolean) =>
  bare
    ? "p-4 sm:p-5"
    : "px-frame px-frame-accent px-scanlines bg-[var(--card)] p-4 sm:p-6";

export function HiScoreBoardSkeleton({ bare = false }: { bare?: boolean }) {
  return (
    <div aria-busy="true" className={boardClass(bare)}>
      <div className="flex items-baseline justify-between gap-3 border-b-4 border-dotted border-[var(--border)] pb-3">
        <h2 className="font-pixel text-lg uppercase tracking-[0.08em] text-[var(--card-foreground)]">
          Hi-scores
        </h2>
        <span className="font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--accent)]">
          Global · live
        </span>
      </div>
      <ol className="mt-3 space-y-1" aria-label="Loading the top five">
        {PLACE.map((place, i) => (
          <li
            key={place}
            className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 px-2 py-2"
          >
            <span
              className="font-pixel text-sm"
              style={{ color: PLACE_COLOR[i] ?? "var(--muted-foreground)" }}
            >
              {place}
            </span>
            <span className="h-6 animate-pulse bg-[var(--control)] motion-reduce:animate-none" />
            <span className="font-pixel text-sm tabular-nums text-[var(--muted-foreground)]">
              ----
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center justify-between gap-3 border-t-4 border-dotted border-[var(--border)] pt-3 font-pixel text-[10px] uppercase tracking-[0.12em]">
        <span className="text-[var(--muted-foreground)]">Loading players…</span>
        <Link
          href="/leaderboard"
          className="-my-2 inline-flex min-h-8 items-center py-2 text-[var(--accent)] hover:underline focus-visible:underline focus-visible:outline-none"
        >
          Full board →
        </Link>
      </div>
    </div>
  );
}

/** The live top five, styled as an arcade cabinet's high-score table. */
export default function HiScoreBoard({
  leaders,
  playerCount,
  bare = false,
}: {
  leaders: LandingLeader[];
  playerCount: number;
  bare?: boolean;
}) {
  return (
    <div className={boardClass(bare)}>
      <div className="flex items-baseline justify-between gap-3 border-b-4 border-dotted border-[var(--border)] pb-3">
        <h2 className="font-pixel text-lg uppercase tracking-[0.08em] text-[var(--card-foreground)]">
          Hi-scores
        </h2>
        <span className="font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--accent)]">
          Global · live
        </span>
      </div>

      {leaders.length === 0 ? (
        <p className="py-10 text-center font-pixel text-sm uppercase text-[var(--muted-foreground)]">
          No players yet.
          <br />
          <span className="text-[var(--accent)]">Be player 1.</span>
        </p>
      ) : (
        <RevealGroup
          as="ol"
          className="mt-3 space-y-1"
          stagger={0.08}
          delay={0.2}
        >
          {leaders.map((leader, i) => {
            const tier = TIER_STYLE[leader.tier];
            return (
              <RevealItem as="li" key={leader.username} y={8}>
                <Link
                  href={`/u/${leader.username.toLowerCase()}`}
                  className="group grid grid-cols-[3rem_1fr_auto] items-center gap-3 px-2 py-2 transition-colors hover:bg-[var(--control)] focus-visible:bg-[var(--control)] focus-visible:outline-none"
                >
                  <span
                    className="font-pixel text-sm"
                    style={{
                      color: PLACE_COLOR[i] ?? "var(--muted-foreground)",
                    }}
                  >
                    {PLACE[i]}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    {/* Requested tiny and scaled up: a pixel-art avatar. */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- deliberately pixelated, not optimised */}
                    <img
                      src={`https://avatars.githubusercontent.com/${encodeURIComponent(leader.username)}?s=16`}
                      alt=""
                      width={24}
                      height={24}
                      loading="lazy"
                      className="h-6 w-6 shrink-0 bg-[var(--control)] [image-rendering:pixelated]"
                    />
                    <span className="truncate font-mono text-sm text-[var(--card-foreground)] group-hover:text-[var(--accent)]">
                      {leader.username}
                    </span>
                    <span title={`${tier.label} tier`} className="shrink-0">
                      <PixelGem
                        color={tier.accent}
                        shine={tier.gem}
                        size={12}
                      />
                      <span className="sr-only">{tier.label} tier</span>
                    </span>
                  </span>
                  <span className="font-pixel text-sm tabular-nums text-[var(--card-foreground)]">
                    {String(leader.scoreV2).padStart(4, "0")}
                  </span>
                </Link>
              </RevealItem>
            );
          })}
        </RevealGroup>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 border-t-4 border-dotted border-[var(--border)] pt-3 font-pixel text-[10px] uppercase tracking-[0.12em]">
        <span className="text-[var(--muted-foreground)]">
          {playerCount} {playerCount === 1 ? "player" : "players"} ranked
        </span>
        <Link
          href="/leaderboard"
          className="-my-2 inline-flex min-h-8 items-center py-2 text-[var(--accent)] hover:underline focus-visible:underline focus-visible:outline-none"
        >
          Full board →
        </Link>
      </div>
    </div>
  );
}
