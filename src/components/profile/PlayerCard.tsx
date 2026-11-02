import type { ReactNode } from "react";
import TierBadge from "@/components/gamification/TierBadge";
import XpBar from "@/components/gamification/XpBar";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { TIER_STYLE } from "@/lib/gamification/tier-palette";
import type { Tier } from "@/lib/gamification/scoring";

export interface HudStat {
  label: string;
  /** Numbers count up; strings render as given. */
  value: number | string;
  prefix?: string;
  suffix?: string;
  /** Small line under the value, e.g. rank movement. */
  sub?: ReactNode;
}

/**
 * The top of a profile, member or guest: a tier-framed avatar, the name, a
 * HUD of headline stats and the XP bar. Everything game-like about a
 * profile lives here, so both kinds of profile look like the same game.
 */
export default function PlayerCard({
  login,
  eyebrow,
  subtitle,
  bio,
  tier,
  xp,
  hud,
  meta,
  actions,
}: {
  login: string;
  eyebrow: ReactNode;
  subtitle?: string | null;
  bio?: string | null;
  tier: Tier | null;
  xp: number | null;
  hud: HudStat[];
  /** Chips under the name: member since, GitHub link and so on. */
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  const frame = tier ? TIER_STYLE[tier].accent : "var(--border)";
  return (
    <section
      aria-label={`@${login}`}
      className="px-frame px-scanlines mb-8 bg-[var(--card)] p-5 sm:p-6"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- GitHub avatar, sized by the URL */}
          <img
            src={`https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=224`}
            alt={`${login}'s GitHub avatar`}
            width={112}
            height={112}
            className="px-frame h-20 w-20 shrink-0 bg-[var(--control)] sm:h-28 sm:w-28"
            style={{ ["--px-c" as string]: frame }}
          />
          <div className="min-w-0">
            <p className="font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
              {eyebrow}
            </p>
            <h1 className="mt-1 break-all font-mono text-xl font-bold leading-tight text-[var(--card-foreground)] sm:text-3xl">
              @{login}
            </h1>
            {subtitle && (
              <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
                {subtitle}
              </p>
            )}
            {bio && (
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--card-foreground)]">
                {bio}
              </p>
            )}
            {meta && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                {meta}
              </div>
            )}
          </div>
        </div>

        <dl className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
          {hud.map((stat) => (
            <div
              key={stat.label}
              className="min-w-[5.5rem] bg-[var(--background)] px-3 py-3 text-center"
            >
              <dt className="font-pixel text-[9px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                {stat.label}
              </dt>
              <dd className="mt-1 font-pixel text-xl tabular-nums text-[var(--card-foreground)] sm:text-2xl">
                {stat.prefix}
                {typeof stat.value === "number" ? (
                  <AnimatedNumber value={stat.value} />
                ) : (
                  stat.value
                )}
                {stat.suffix}
              </dd>
              {stat.sub && (
                <dd className="mt-0.5 flex justify-center text-[10px]">
                  {stat.sub}
                </dd>
              )}
            </div>
          ))}
        </dl>
      </div>

      {(tier || xp !== null) && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t-4 border-dotted border-[var(--border)] pt-4">
          {tier && <TierBadge tier={tier} />}
          {xp !== null && <XpBar xp={xp} className="min-w-[12rem] flex-1" />}
        </div>
      )}

      {actions && (
        <div className="-m-1 mt-5 flex flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </section>
  );
}
