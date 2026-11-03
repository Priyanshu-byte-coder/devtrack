"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { Flame, Swords, UserRound } from "lucide-react";
import TierBadge from "@/components/gamification/TierBadge";
import LevelChip from "@/components/gamification/LevelChip";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { normalizeGitHubUsername } from "@/lib/validate-github-username";
import { TIER_STYLE } from "@/lib/gamification/tier-palette";
import type { Tier } from "@/lib/gamification/scoring";
import type { ScorePreview } from "@/lib/score-preview";
import { spring } from "@/lib/motion";

type State =
  | { kind: "idle" }
  | { kind: "loading"; login: string }
  | { kind: "result"; preview: ScorePreview }
  | { kind: "error"; message: string };

const ERRORS: Record<string, string> = {
  "not-found":
    "No public GitHub user by that name (or their profile is private).",
  busy: "GitHub is busy for a moment. Try again in a minute.",
  "slow-down": "Easy, speedrunner. Try again in a minute.",
  invalid: "That isn't a valid GitHub username.",
};

const fmt = new Intl.NumberFormat("en-US");

/**
 * The hero's playable part. Type any GitHub username and the hi-score table
 * on the right flips into that player's arcade card: estimated rank, tier,
 * level and streak, with a nudge to claim it or start a duel. Nobody has to
 * sign up to get the payoff.
 */
export default function HeroStage({
  intro,
  board,
}: {
  /** Headline, copy and sign-in buttons, rendered on the server. */
  intro: ReactNode;
  /** The hi-score table shown until someone plays. */
  board: ReactNode;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [value, setValue] = useState("");
  const inputId = useId();
  const hintId = useId();
  const request = useRef(0);

  async function play(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const login = normalizeGitHubUsername(value.replace(/^@/, ""));
    if (!login) {
      setState({ kind: "error", message: ERRORS.invalid });
      return;
    }
    const id = ++request.current;
    setState({ kind: "loading", login });
    try {
      const res = await fetch(
        `/api/score-preview?user=${encodeURIComponent(login)}`
      );
      const body = (await res.json()) as ScorePreview & { error?: string };
      if (id !== request.current) return;
      if (!res.ok || body.error) {
        setState({
          kind: "error",
          message:
            ERRORS[body.error ?? ""] ?? "Something went wrong. Try again.",
        });
        return;
      }
      setState({ kind: "result", preview: body });
    } catch {
      if (id === request.current) {
        setState({
          kind: "error",
          message: "Couldn't reach DevTrack. Try again.",
        });
      }
    }
  }

  return (
    <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14 lg:px-8">
      <div className="min-w-0">
        {intro}

        <form onSubmit={play} role="search" className="mt-10 max-w-md">
          <label
            htmlFor={inputId}
            className="font-pixel text-xs uppercase tracking-[0.12em] text-[var(--accent)]"
          >
            Score attack · where would you rank?
          </label>
          <div className="mt-2 flex items-stretch">
            <div className="px-frame flex min-w-0 flex-1 items-center bg-[var(--card)]">
              <span
                aria-hidden="true"
                className="pl-3 font-pixel text-sm text-[var(--accent)]"
              >
                @
              </span>
              <input
                id={inputId}
                name="login"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="any-github-username"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby={hintId}
                className="w-0 min-w-0 flex-1 bg-transparent px-2 py-3 font-mono text-sm text-[var(--card-foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-btn ml-2 shrink-0"
              disabled={state.kind === "loading"}
            >
              Play ▶
            </button>
          </div>
          <p
            id={hintId}
            role={state.kind === "error" ? "alert" : undefined}
            className={`mt-2 text-xs ${
              state.kind === "error"
                ? "text-[var(--destructive)]"
                : "text-[var(--muted-foreground)]"
            }`}
          >
            {state.kind === "error"
              ? state.message
              : "Try yours, a friend's, or torvalds. No sign-up."}
          </p>
        </form>
      </div>

      <div className="min-w-0" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {state.kind === "result" ? (
            <ResultCard
              key={`result-${state.preview.login}`}
              preview={state.preview}
              onReset={() => setState({ kind: "idle" })}
            />
          ) : state.kind === "loading" ? (
            <Scanning key="loading" login={state.login} />
          ) : (
            <m.div
              key="board"
              initial={{ opacity: 0, rotateY: -90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: 90 }}
              transition={{ duration: 0.25 }}
            >
              {board}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Scanning({ login }: { login: string }) {
  return (
    <m.div
      initial={{ opacity: 0, rotateY: -90 }}
      animate={{ opacity: 1, rotateY: 0 }}
      exit={{ opacity: 0, rotateY: 90 }}
      transition={{ duration: 0.2 }}
      className="px-frame px-frame-accent px-scanlines bg-[var(--card)] p-8 text-center"
    >
      <p className="font-pixel text-sm uppercase tracking-[0.14em] text-[var(--card-foreground)]">
        Scanning @{login}
      </p>
      <div className="mx-auto mt-5 flex w-56 gap-1" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <m.span
            key={i}
            className="h-3 flex-1 bg-[var(--accent)]"
            initial={{ opacity: 0.15 }}
            animate={{ opacity: [0.15, 1, 0.15] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.07 }}
          />
        ))}
      </div>
      <p className="mt-4 text-xs text-[var(--muted-foreground)]">
        Reading a year of GitHub activity…
      </p>
    </m.div>
  );
}

function ResultCard({
  preview,
  onReset,
}: {
  preview: ScorePreview;
  onReset: () => void;
}) {
  const tier = (preview.tier ?? null) as Tier | null;
  const frame = tier ? TIER_STYLE[tier].accent : "var(--border)";
  const profileHref = `/u/${preview.login.toLowerCase()}`;
  return (
    <m.section
      aria-label={`@${preview.login}'s score`}
      initial={{ opacity: 0, rotateY: -90, scale: 0.9 }}
      animate={{ opacity: 1, rotateY: 0, scale: 1 }}
      exit={{ opacity: 0, rotateY: 90 }}
      transition={spring.bouncy}
      className="px-frame px-scanlines bg-[var(--card)] p-5 sm:p-6"
      style={{ ["--px-c" as string]: frame }}
    >
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- GitHub avatar, sized by the URL */}
        <img
          src={`https://avatars.githubusercontent.com/${encodeURIComponent(preview.login)}?s=128`}
          alt=""
          width={64}
          height={64}
          className="px-frame h-16 w-16 shrink-0 bg-[var(--control)]"
          style={{ ["--px-c" as string]: frame }}
        />
        <div className="min-w-0">
          <p className="font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
            {preview.member ? "DevTrack player" : "Not on DevTrack yet"}
          </p>
          <p className="truncate font-mono text-lg font-bold text-[var(--card-foreground)]">
            @{preview.login}
          </p>
          {preview.name && (
            <p className="truncate text-xs text-[var(--muted-foreground)]">
              {preview.name}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 border-y-4 border-dotted border-[var(--border)] py-4 text-center">
        {preview.rank !== null ? (
          <>
            <p className="font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              {preview.rankEstimated ? "Would rank" : "Global rank"}
            </p>
            <p className="mt-1 font-pixel text-6xl tabular-nums leading-none text-[var(--card-foreground)]">
              {preview.rankEstimated ? "~" : ""}#
              <AnimatedNumber value={preview.rank} />
            </p>
            {preview.players > 0 && (
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                of {fmt.format(preview.players)} players worldwide
              </p>
            )}
          </>
        ) : (
          <p className="font-pixel text-sm uppercase text-[var(--muted-foreground)]">
            Not on the leaderboard
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {tier && <TierBadge tier={tier} />}
        <LevelChip level={preview.level} />
        {preview.streak !== null && (
          <span className="inline-flex items-center gap-1 font-pixel text-xs text-[var(--card-foreground)]">
            <Flame className="h-3.5 w-3.5 text-orange-400" aria-hidden="true" />
            <AnimatedNumber value={preview.streak} />D streak
          </span>
        )}
        {preview.contributions !== null && (
          <span className="font-pixel text-xs text-[var(--muted-foreground)]">
            <AnimatedNumber value={preview.contributions} /> contribs/yr
          </span>
        )}
      </div>

      <div className="-m-1 mt-5 flex flex-wrap justify-center gap-2">
        {!preview.member && (
          <Link
            href={`/claim?login=${encodeURIComponent(preview.login.toLowerCase())}`}
            className="px-btn px-btn-sm"
          >
            Is this you? Claim it
          </Link>
        )}
        <Link href={profileHref} className="px-btn px-btn-sm px-btn-ghost">
          <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
          Full profile
        </Link>
        <Link
          href={`/compare?vs=${encodeURIComponent(preview.login.toLowerCase())}`}
          className="px-btn px-btn-sm px-btn-ghost"
        >
          <Swords className="h-3.5 w-3.5" aria-hidden="true" />
          Challenge
        </Link>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="mx-auto mt-4 block font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] hover:text-[var(--accent)]"
      >
        ◀ Back to hi-scores
      </button>
    </m.section>
  );
}
