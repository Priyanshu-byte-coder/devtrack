import type { Metadata } from "next";
import Link from "next/link";
import RematchForm from "@/components/compare/RematchForm";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { getLeaderboardData } from "@/lib/leaderboard";
import { rankEntriesByScoreV2 } from "@/lib/gamification/ranking";
import { ROUNDS, duelPath } from "@/lib/duel";
import { normalizeGitHubUsername } from "@/lib/validate-github-username";

export const metadata: Metadata = {
  title: "Compare GitHub profiles",
  description:
    "Put any two GitHub users head to head: streaks, contributions, commits, pull requests and code reviews, scored round by round. Free, no sign-up.",
  alternates: { canonical: "/compare" },
  openGraph: {
    title: "Compare GitHub profiles · DevTrack",
    description:
      "Any two developers, head to head on streaks, contributions, PRs and reviews.",
    url: "/compare",
  },
};

/** Featured duels from the top of the board: 1 vs 2, 1 vs 3, 2 vs 3. */
async function featuredDuels(): Promise<Array<[string, string]>> {
  try {
    const board = await Promise.race([
      getLeaderboardData(false, { period: "all" }),
      new Promise<null>((r) => setTimeout(() => r(null), 2500)),
    ]);
    if (!board) return [];
    const top = rankEntriesByScoreV2(Object.values(board.leaders).flat())
      .slice(0, 3)
      .map((e) => e.username);
    const pairs: Array<[number, number]> = [
      [0, 1],
      [0, 2],
      [1, 2],
    ];
    return pairs
      .filter(([a, b]) => top[a] && top[b])
      .map(([a, b]) => [top[a], top[b]]);
  } catch {
    return [];
  }
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ vs?: string | string[] }>;
}) {
  const { vs } = await searchParams;
  // "Duel @x" on a profile lands here with Player 2 filled in.
  const opponent = normalizeGitHubUsername(Array.isArray(vs) ? vs[0] : vs);
  const duels = await featuredDuels();
  return (
    <div className="pb-10">
      <p className="font-pixel text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
        Versus mode
      </p>
      <h1 className="mt-2 font-pixel text-[clamp(2rem,5vw,3.25rem)] uppercase leading-none text-[var(--foreground)]">
        Compare developers
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
        Pick any two GitHub users and they go head to head, round by round, on
        their public activity. Neither needs a DevTrack account.
      </p>

      <section
        aria-label="Start a duel"
        className="px-frame px-frame-accent mt-8 bg-[var(--card)] p-5 sm:p-6"
      >
        <RematchForm defaultRight={opponent ?? ""} />
      </section>

      {duels.length > 0 && (
        <section aria-labelledby="featured-heading" className="mt-12">
          <h2
            id="featured-heading"
            className="font-pixel text-sm uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
          >
            Featured duels
          </h2>
          <RevealGroup
            as="ul"
            className="mt-4 grid gap-3 sm:grid-cols-3"
            stagger={0.08}
          >
            {duels.map(([a, b]) => (
              <RevealItem as="li" key={`${a}-${b}`} className="min-w-0">
                <Link
                  href={duelPath(a, b)}
                  className="px-frame flex items-center justify-between gap-2 bg-[var(--card)] px-4 py-3 font-mono text-sm text-[var(--card-foreground)] transition-colors hover:bg-[var(--control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <span className="min-w-0 truncate">@{a}</span>
                  <span className="shrink-0 font-pixel text-xs text-[var(--accent)]">
                    VS
                  </span>
                  <span className="min-w-0 truncate text-right">@{b}</span>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      <section aria-labelledby="rules-heading" className="mt-12 max-w-2xl">
        <h2
          id="rules-heading"
          className="font-pixel text-xl uppercase text-[var(--foreground)]"
        >
          How a duel is scored
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          Each stat is a round. Whoever has more takes it; the developer who
          wins the most rounds wins the duel. Both sides are measured from
          public GitHub data the same way, so it&apos;s a fair fight. If a
          DevTrack member hides a stat on their profile, that round is a no
          contest.
        </p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {ROUNDS.map((round, i) => (
            <li
              key={round.key}
              className="flex items-baseline gap-3 border-2 border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--card-foreground)]"
            >
              <span className="font-pixel text-xs text-[var(--accent)]">
                R{i + 1}
              </span>
              {round.label}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
