import { Suspense } from "react";
import { Github, Star } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import FallingBlocks from "./FallingBlocks";
import HeroStage from "./ScoreAttack";
import HiScoreBoard, { HiScoreBoardSkeleton } from "./HiScoreBoard";
import { REPO_URL, SIGN_IN_HREF, type LandingBoard } from "./types";

const TICKER = [
  "+10 XP per commit",
  "+40 XP per pull request",
  "+15 XP per review",
  "Ranks update daily",
  "New season every month",
  "Bronze · Silver · Gold · Platinum · Diamond · Legend",
  "README badges",
  "Free and open source",
];

async function LiveHiScoreBoard({ board }: { board: Promise<LandingBoard> }) {
  const { leaders, playerCount } = await board;
  return <HiScoreBoard leaders={leaders} playerCount={playerCount} />;
}

export default function Hero({ board }: { board: Promise<LandingBoard> }) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="px-grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
      />
      <div className="relative">
        <FallingBlocks className="absolute inset-x-0 bottom-0 h-44 w-full opacity-70 [mask-image:linear-gradient(to_top,black,transparent)]" />
        <HeroStage
          board={
            <Reveal delay={0.15}>
              <Suspense fallback={<HiScoreBoardSkeleton />}>
                <LiveHiScoreBoard board={board} />
              </Suspense>
            </Reveal>
          }
          intro={
            <>
              <p className="inline-flex items-center gap-2 font-pixel text-[11px] uppercase tracking-[0.16em] text-[var(--accent)]">
                <span
                  aria-hidden="true"
                  className="px-blink inline-block h-2 w-2 bg-[var(--success)]"
                />
                Insert coin · free forever
              </p>

              <h1
                id="hero-heading"
                className="mt-5 font-pixel text-[clamp(2.4rem,6.4vw,4.6rem)] uppercase leading-[0.95] tracking-[-0.01em] text-[var(--foreground)]"
              >
                Turn your GitHub into a{" "}
                <span className="text-[var(--accent)] [text-shadow:4px_4px_0_color-mix(in_srgb,var(--accent)_25%,transparent)]">
                  high score.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-[var(--muted-foreground)] sm:text-lg">
                Track your streak, earn XP for every commit, PR and review, and
                rank against developers worldwide. Built from your real GitHub
                activity, no setup required.
              </p>

              <div className="mt-8">
                <p
                  aria-hidden="true"
                  className="px-blink mb-1 font-pixel text-xs uppercase tracking-[0.2em] text-[var(--accent)]"
                >
                  ▶ Press start
                </p>
                <div className="-m-1 flex flex-wrap items-center gap-2">
                  <a href={SIGN_IN_HREF} className="px-btn">
                    <Github className="h-4 w-4" aria-hidden="true" />
                    Sign in with GitHub
                  </a>
                  <a
                    href={REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-btn px-btn-ghost"
                  >
                    <Star className="h-4 w-4" aria-hidden="true" />
                    Star on GitHub
                  </a>
                </div>
              </div>
            </>
          }
        />
      </div>

      {/* Decorative: every line here is said again further down the page. */}
      <div
        aria-hidden="true"
        className="overflow-hidden border-y-4 border-[var(--border)] bg-[var(--card)] py-3"
      >
        <div className="px-marquee flex w-max gap-10 whitespace-nowrap font-pixel text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          {[...TICKER, ...TICKER].map((item, i) => (
            <span key={i} className="flex items-center gap-10">
              {item}
              <span className="text-[var(--accent)]">◆</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
