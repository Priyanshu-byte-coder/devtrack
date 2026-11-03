import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import TierBadge from "@/components/gamification/TierBadge";
import LevelChip from "@/components/gamification/LevelChip";
import DuelRounds from "@/components/compare/DuelRounds";
import RematchForm from "@/components/compare/RematchForm";
import CopyLinkButton from "@/components/CopyLinkButton";
import { isValidGitHubUsername } from "@/lib/validate-github-username";
import {
  duelPath,
  duelShareText,
  parseDuelSlug,
  scoreDuel,
  type DuelFighter,
  type Side,
} from "@/lib/duel";
import { getDuelFighter } from "@/lib/duel-data";
import GitHubBusy from "@/components/GitHubBusy";
import { isGitHubBusyError } from "@/lib/github-busy";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://devtrack.live";
const SIDE_COLOR: Record<Side, string> = {
  left: "var(--accent)",
  right: "#fb7185",
};

function parse(slug: string) {
  return parseDuelSlug(slug, isValidGitHubUsername);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ users: string }>;
}): Promise<Metadata> {
  const { users } = await params;
  const parsed = parse(users);
  if (!parsed) {
    return {
      title: "Compare developers",
      robots: { index: false, follow: true },
    };
  }
  const [left, right] = parsed;
  const title = `${left} vs ${right}: GitHub stats duel`;
  const description = `Who wins? ${left} and ${right} go head to head on streaks, contributions, pull requests and reviews on DevTrack.`;
  return {
    title,
    description,
    // Every pair is its own URL; indexing them would flood search with
    // near-duplicates. They exist to be shared, and still pass link equity.
    robots: { index: false, follow: true },
    alternates: { canonical: duelPath(left, right) },
    openGraph: { title, description, url: duelPath(left, right) },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function DuelPage({
  params,
}: {
  params: Promise<{ users: string }>;
}) {
  const { users } = await params;
  const parsed = parse(users);
  if (!parsed) notFound();

  const canonical = duelPath(parsed[0], parsed[1]);
  if (`/compare/${users}` !== canonical) permanentRedirect(canonical);

  let fighters: Awaited<ReturnType<typeof getDuelFighter>>[];
  try {
    fighters = await Promise.all(parsed.map(getDuelFighter));
  } catch (error) {
    if (!isGitHubBusyError(error)) throw error;
    return <GitHubBusy retryHref={canonical} what="this duel" />;
  }
  const [left, right] = fighters;
  if (!left || !right) {
    return (
      <DuelUnavailable
        missing={[!left && parsed[0], !right && parsed[1]].filter(
          (x): x is string => Boolean(x)
        )}
      />
    );
  }

  const result = scoreDuel(left, right);
  const url = `${BASE_URL}${canonical}`;
  const shareText = duelShareText(left, right, result);
  const xHref = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(`${url}?utm_source=x&utm_medium=social&utm_campaign=duel`)}`;
  const winner = result.winner
    ? result.winner === "left"
      ? left
      : right
    : null;

  return (
    <div className="pb-10">
      <p className="font-pixel text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
        Duel
      </p>
      <h1 className="sr-only">
        @{left.login} vs @{right.login}
      </h1>

      {/* Fighters */}
      <section
        aria-label="Fighters"
        className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6"
      >
        <Fighter fighter={left} side="left" />
        <span
          aria-hidden="true"
          className="font-pixel text-4xl text-[var(--foreground)] [text-shadow:3px_3px_0_var(--accent),-3px_-3px_0_#fb7185] sm:text-6xl"
        >
          VS
        </span>
        <Fighter fighter={right} side="right" />
      </section>

      {/* Verdict */}
      <section
        aria-label="Result"
        className="px-frame px-scanlines mt-8 bg-[var(--card)] px-4 py-6 text-center"
        style={
          winner
            ? { ["--px-c" as string]: SIDE_COLOR[result.winner as Side] }
            : undefined
        }
      >
        <p className="font-pixel text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          {result.flawless ? "Flawless victory" : winner ? "Winner" : "Result"}
        </p>
        <p className="mt-2 font-pixel text-3xl uppercase leading-none text-[var(--card-foreground)] sm:text-5xl">
          {winner ? (
            <>
              <span style={{ color: SIDE_COLOR[result.winner as Side] }}>
                @{winner.login}
              </span>{" "}
              wins
            </>
          ) : (
            "Draw"
          )}
        </p>
        <p className="mt-3 font-pixel text-2xl tabular-nums text-[var(--card-foreground)]">
          <span style={{ color: SIDE_COLOR.left }}>{result.wins.left}</span>
          <span className="mx-3 text-[var(--muted-foreground)]">–</span>
          <span style={{ color: SIDE_COLOR.right }}>{result.wins.right}</span>
        </p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          rounds won · from public GitHub activity
        </p>
      </section>

      {/* Rounds */}
      <section aria-labelledby="rounds-heading" className="mt-8">
        <h2
          id="rounds-heading"
          className="mb-3 font-pixel text-sm uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
        >
          Round by round
        </h2>
        <div className="px-frame bg-[var(--border)]">
          <DuelRounds
            rounds={result.rounds}
            leftLogin={left.login}
            rightLogin={right.login}
          />
        </div>
        <p className="mt-3 text-center text-sm text-[var(--muted-foreground)]">
          Main language:{" "}
          <strong className="text-[var(--card-foreground)]">
            {left.topLanguage ?? "—"}
          </strong>{" "}
          vs{" "}
          <strong className="text-[var(--card-foreground)]">
            {right.topLanguage ?? "—"}
          </strong>
        </p>
      </section>

      {/* Share and rematch */}
      <section
        aria-labelledby="rematch-heading"
        className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.4fr]"
      >
        <div className="min-w-0">
          <h2
            id="rematch-heading"
            className="font-pixel text-xl uppercase text-[var(--foreground)]"
          >
            Call it out
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            {shareText}
          </p>
          <div className="-m-1 mt-4 flex flex-wrap items-center gap-2">
            <a
              href={xHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-btn"
            >
              Post on X
            </a>
            <CopyLinkButton url={url} />
          </div>
        </div>
        <div className="min-w-0">
          <h2 className="font-pixel text-xl uppercase text-[var(--foreground)]">
            Rematch
          </h2>
          <div className="mt-3">
            <RematchForm
              defaultLeft={left.login}
              defaultRight=""
              submitLabel="New duel"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Fighter({ fighter, side }: { fighter: DuelFighter; side: Side }) {
  const right = side === "right";
  const rank =
    fighter.rank === null
      ? fighter.member && fighter.tier === null
        ? "Not on the board"
        : "Unranked"
      : `${fighter.rankEstimated ? "~" : ""}#${fighter.rank} global${fighter.rankEstimated ? " (est.)" : ""}`;
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:gap-4 ${
        right ? "sm:flex-row-reverse sm:text-right" : "sm:text-left"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- GitHub avatar, sized by the URL */}
      <img
        src={`https://avatars.githubusercontent.com/${encodeURIComponent(fighter.login)}?s=192`}
        alt=""
        width={96}
        height={96}
        className="px-frame h-16 w-16 shrink-0 bg-[var(--control)] sm:h-24 sm:w-24"
        style={{ ["--px-c" as string]: SIDE_COLOR[side] }}
      />
      <div className="min-w-0 max-w-full">
        <p
          className="font-pixel text-[10px] uppercase tracking-[0.16em]"
          style={{ color: SIDE_COLOR[side] }}
        >
          Player {right ? 2 : 1}
        </p>
        <Link
          href={`/u/${fighter.login.toLowerCase()}`}
          className="block truncate font-mono text-base font-bold text-[var(--foreground)] hover:text-[var(--accent)] sm:text-xl"
        >
          @{fighter.login}
        </Link>
        <div
          className={`mt-1 flex flex-wrap items-center justify-center gap-1.5 ${
            right ? "sm:justify-end" : "sm:justify-start"
          }`}
        >
          {fighter.tier && <TierBadge tier={fighter.tier} compact />}
          <LevelChip level={fighter.level} />
        </div>
        <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
          {rank}
        </p>
      </div>
    </div>
  );
}

function DuelUnavailable({ missing }: { missing: string[] }) {
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <p className="font-pixel text-xs uppercase tracking-[0.18em] text-[var(--destructive)]">
        Player not found
      </p>
      <h1 className="mt-3 font-pixel text-3xl uppercase text-[var(--foreground)]">
        No contest
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
        {missing.map((m) => `@${m}`).join(" and ")}{" "}
        {missing.length === 1 ? "isn't" : "aren't"} on GitHub, or made their
        DevTrack profile private.
      </p>
      <div className="mt-8 text-left">
        <RematchForm />
      </div>
    </div>
  );
}
