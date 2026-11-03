import { Suspense } from "react";
import { JsonLd } from "@/lib/seo/json-ld";
import BootIntro from "./BootIntro";
import Hero from "./Hero";
import { HowToPlay, TierLadder } from "./Gameplay";
import { FlexBadges, PowerUps } from "./Flex";
import { CoOp, Continue, Faq, faqJsonLd } from "./Community";
import type { LandingBoard, RepoStats } from "./types";

const NO_REPO_STATS: RepoStats = {
  stars: 0,
  forks: 0,
  openIssues: 0,
  contributorCount: 0,
  goodFirstIssues: 0,
  contributors: [],
  totalCommits: 0,
  mergedPRs: 0,
};

async function LiveCoOp({ stats }: { stats: Promise<RepoStats> }) {
  return <CoOp stats={await stats} />;
}

/**
 * The arcade landing page. Each section is server-rendered; motion is opt-in
 * per element. The live data arrives as promises so the page streams at once
 * and the hi-scores and repository numbers fill in when they're ready.
 */
export default function ArcadeLanding({
  repoStats,
  board,
}: {
  repoStats: Promise<RepoStats>;
  board: Promise<LandingBoard>;
}) {
  return (
    <div className="bg-[var(--background)] text-[var(--foreground)]">
      <BootIntro />
      <JsonLd data={faqJsonLd()} />
      <Hero board={board} />
      <HowToPlay />
      <TierLadder />
      <FlexBadges />
      <PowerUps />
      <Suspense fallback={<CoOp stats={NO_REPO_STATS} />}>
        <LiveCoOp stats={repoStats} />
      </Suspense>
      <Faq />
      <Continue />
    </div>
  );
}
