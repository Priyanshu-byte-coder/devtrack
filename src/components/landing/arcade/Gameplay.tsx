import SwipeDots from "@/components/ui/SwipeDots";
import { LogIn, TrendingUp, Trophy } from "lucide-react";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { PixelGem } from "@/components/gamification/TierBadge";
import { TIER_STYLE } from "@/lib/gamification/tier-palette";
import {
  SCORE_WEIGHTS,
  TIER_THRESHOLDS,
  TIERS,
  XP_PER,
} from "@/lib/gamification/scoring";
import SectionHeading from "./SectionHeading";

const STEPS = [
  {
    icon: LogIn,
    label: "1P start",
    title: "Sign in with GitHub",
    body: "One click. Your history is already on GitHub, so there's nothing to set up and no tracking script to install.",
  },
  {
    icon: TrendingUp,
    label: "Earn XP",
    title: "Play your normal game",
    body: `Commits earn ${XP_PER.commit} XP, pull requests ${XP_PER.pr}, reviews ${XP_PER.review}. XP never goes down, and every level takes a little more.`,
  },
  {
    icon: Trophy,
    label: "Climb",
    title: "Rank against the world",
    body: "Ranks update every day on global, monthly and weekly boards. Each month is a new season with a fresh race.",
  },
];

export function HowToPlay() {
  return (
    <section
      aria-labelledby="how-heading"
      className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8"
    >
      <SectionHeading
        id="how-heading"
        eyebrow="How to play"
        title="Three steps to the board"
      >
        DevTrack turns the work you already do on GitHub into a game you can
        win: a streak to protect, XP to bank and a rank to defend.
      </SectionHeading>

      {/* Phones swipe through the steps; wider screens see all three. */}
      <RevealGroup
        as="ol"
        id="how-steps"
        className="swipe-row -mx-4 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 py-2 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:py-0"
        stagger={0.1}
      >
        {STEPS.map((step, i) => (
          <RevealItem
            as="li"
            key={step.label}
            className="px-frame w-[80%] shrink-0 snap-center bg-[var(--card)] p-6 md:w-auto"
          >
            <div className="flex items-center justify-between">
              <span className="font-pixel text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                {step.label}
              </span>
              <span
                className="font-pixel text-3xl text-[var(--border)]"
                aria-hidden="true"
              >
                0{i + 1}
              </span>
            </div>
            <step.icon
              className="mt-6 h-8 w-8 text-[var(--accent)]"
              aria-hidden="true"
            />
            <h3 className="mt-4 text-lg font-semibold text-[var(--card-foreground)]">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {step.body}
            </p>
          </RevealItem>
        ))}
      </RevealGroup>
      <SwipeDots targetId="how-steps" count={STEPS.length} label="Steps" />
    </section>
  );
}

const SIGNALS: Array<{
  key: keyof typeof SCORE_WEIGHTS;
  name: string;
  body: string;
}> = [
  {
    key: "consistency",
    name: "Consistency",
    body: "Days you contributed, plus your current streak.",
  },
  {
    key: "impact",
    name: "Impact",
    body: "Pull requests, with code reviews counting half.",
  },
  { key: "volume", name: "Volume", body: "Commits." },
  {
    key: "breadth",
    name: "Breadth",
    body: "Repositories you contributed to.",
  },
];

export function TierLadder() {
  return (
    <section
      aria-labelledby="tiers-heading"
      className="border-y-4 border-[var(--border)] bg-[var(--card)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          id="tiers-heading"
          eyebrow="Tiers"
          title="Bronze to Legend"
        >
          Your DevTrack score runs from 0 to 1000. Cross a threshold and you
          move up a tier, shown on your profile, your share card and your README
          badge.
        </SectionHeading>

        <RevealGroup
          as="ol"
          className="mt-12 grid grid-cols-3 gap-4 sm:grid-cols-6"
          stagger={0.08}
        >
          {TIERS.map((tier) => {
            const style = TIER_STYLE[tier];
            return (
              <RevealItem
                as="li"
                key={tier}
                className="flex flex-col items-center gap-3 bg-[var(--background)] px-2 py-5 text-center"
              >
                <PixelGem color={style.accent} shine={style.gem} size={44} />
                <span
                  className="font-pixel text-sm uppercase"
                  // Pulled toward the text colour so it reads on light themes.
                  style={{
                    color: `color-mix(in srgb, ${style.accent} 60%, var(--foreground))`,
                  }}
                >
                  {style.label}
                </span>
                <span className="font-pixel text-[10px] text-[var(--muted-foreground)]">
                  {TIER_THRESHOLDS[tier]}+
                </span>
              </RevealItem>
            );
          })}
        </RevealGroup>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <h3 className="font-pixel text-xl uppercase text-[var(--card-foreground)]">
              How the score works
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              Four signals, each measured two ways: progress toward a fixed
              target, so a score means the same thing on any day, and your place
              among everyone on the board, so it stays a race. Progress is
              log-scaled: the first hundred commits count for more than the next
              hundred.
            </p>
          </div>
          <dl className="space-y-5">
            {SIGNALS.map((signal) => {
              const pct = Math.round(SCORE_WEIGHTS[signal.key] * 100);
              return (
                // A <dl> group may only hold <dt> and <dd>, so the row is a
                // grid rather than a wrapper div, and the meter sits in the
                // description.
                <div
                  key={signal.key}
                  className="grid grid-cols-[1fr_auto] items-baseline gap-x-4"
                >
                  <dt className="font-pixel text-sm uppercase text-[var(--card-foreground)]">
                    {signal.name}
                  </dt>
                  <dd className="font-pixel text-sm text-[var(--accent)]">
                    {pct}%
                  </dd>
                  <dd className="col-span-2 mt-2 text-sm text-[var(--muted-foreground)]">
                    <span aria-hidden="true" className="flex gap-1">
                      {Array.from({ length: 20 }, (_, i) => (
                        <span
                          key={i}
                          className={`h-3 flex-1 ${i < pct / 5 ? "bg-[var(--accent)]" : "bg-[var(--control)]"}`}
                        />
                      ))}
                    </span>
                    <span className="mt-2 block">{signal.body}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </section>
  );
}
