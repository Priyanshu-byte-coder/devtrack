import { Github, Star } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import DevLookup from "./DevLookup";
import HiScoreBoard from "./HiScoreBoard";
import { REPO_URL, SIGN_IN_HREF, type LandingLeader } from "./types";

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

export default function Hero({
  leaders,
  playerCount,
}: {
  leaders: LandingLeader[];
  playerCount: number;
}) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="px-grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14 lg:px-8">
        <div className="min-w-0">
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
            Track your streak, earn XP for every commit, PR and review, and rank
            against developers worldwide. Built from your real GitHub activity,
            no setup required.
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

          <DevLookup className="mt-10 max-w-md" />
        </div>

        <Reveal delay={0.15} className="min-w-0">
          <HiScoreBoard leaders={leaders} playerCount={playerCount} />
        </Reveal>
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
