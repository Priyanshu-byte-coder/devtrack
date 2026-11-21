"use client";

import Link from "@/components/Link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, m } from "motion/react";
import { Flame, Swords, UserRound } from "lucide-react";
import TierBadge from "@/components/gamification/TierBadge";
import LevelChip from "@/components/gamification/LevelChip";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { normalizeGitHubUsername } from "@/lib/validate-github-username";
import { TIER_STYLE } from "@/lib/gamification/tier-palette";
import type { Tier } from "@/lib/gamification/scoring";
import type { ScorePreview } from "@/lib/score-preview";
import ArcadeCabinet from "./ArcadeCabinet";

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

/** Switching what the cabinet screen shows: a quick CRT flick. */
const crt = {
  initial: { opacity: 0, scaleY: 0.03 },
  animate: { opacity: 1, scaleY: 1 },
  exit: { opacity: 0, scaleY: 0.03 },
  transition: { duration: 0.18 },
};

/**
 * The hero's playable part. Type any GitHub username and the arcade
 * cabinet's screen switches from the hi-score table to that player's card:
 * estimated rank, tier, level and streak, with a nudge to claim it or start a
 * duel. Nobody has to sign up to get the payoff.
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
  const [coins, setCoins] = useState(0);
  const screenRef = useRef<HTMLDivElement>(null);

  // On a phone the cabinet sits below the form: bring its screen into view
  // when it starts showing the lookup.
  const showing = state.kind === "loading" || state.kind === "result";
  useEffect(() => {
    const screen = screenRef.current;
    if (!showing || !screen || window.innerWidth >= 1024) return;
    const { top, bottom } = screen.getBoundingClientRect();
    if (top >= 0 && bottom <= window.innerHeight) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    screen.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "center",
    });
  }, [showing]);

  async function play(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const login = normalizeGitHubUsername(value.replace(/^@/, ""));
    if (!login) {
      setState({ kind: "error", message: ERRORS.invalid });
      return;
    }
    const id = ++request.current;
    setCoins((c) => c + 1);
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
        <ArcadeCabinet
          coins={coins}
          busy={state.kind === "loading"}
          glow={
            state.kind === "error"
              ? "#f87171"
              : state.kind === "result" && state.preview.tier
                ? TIER_STYLE[state.preview.tier as Tier].accent
                : undefined
          }
          screenRef={screenRef}
        >
          <AnimatePresence mode="wait" initial={false}>
            {state.kind === "result" ? (
              <ResultCard
                key={`result-${state.preview.login}`}
                preview={state.preview}
                onReset={() => setState({ kind: "idle" })}
              />
            ) : state.kind === "loading" ? (
              <Scanning key="loading" login={state.login} />
            ) : state.kind === "error" ? (
              <GameOver
                key="error"
                message={state.message}
                onReset={() => setState({ kind: "idle" })}
              />
            ) : (
              <m.div key="board" {...crt}>
                {board}
              </m.div>
            )}
          </AnimatePresence>
        </ArcadeCabinet>
      </div>
    </div>
  );
}

/** A lookup that went wrong, shown big on the cabinet screen. */
function GameOver({
  message,
  onReset,
}: {
  message: string;
  onReset: () => void;
}) {
  return (
    <m.div
      {...crt}
      className="flex min-h-[22rem] flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <p className="font-pixel text-3xl uppercase leading-none text-[#f87171] [text-shadow:3px_3px_0_rgba(248,113,113,0.25)] sm:text-4xl">
        Game over
      </p>
      <p className="max-w-xs text-sm text-[var(--muted-foreground)]">
        {message}
      </p>
      <p className="px-blink font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
        Insert coin to try again
      </p>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex min-h-8 items-center font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] hover:text-[var(--accent)]"
      >
        ◀ Back to hi-scores
      </button>
    </m.div>
  );
}

function Scanning({ login }: { login: string }) {
  return (
    <m.div
      {...crt}
      className="flex min-h-[22rem] flex-col items-center justify-center p-8 text-center"
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
      {...crt}
      className="p-5 sm:p-6"
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
            rel="nofollow"
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
          rel="nofollow"
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
