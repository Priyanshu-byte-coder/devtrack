import { JsonLd } from "@/lib/seo/json-ld";
import Hero from "./Hero";
import { HowToPlay, TierLadder } from "./Gameplay";
import { FlexBadges, PowerUps } from "./Flex";
import { CoOp, Continue, Faq, faqJsonLd } from "./Community";
import type { LandingLeader, RepoStats } from "./types";

/** The arcade landing page. Each section is server-rendered; motion is opt-in per element. */
export default function ArcadeLanding({
  repoStats,
  leaders,
  playerCount,
}: {
  repoStats: RepoStats;
  leaders: LandingLeader[];
  playerCount: number;
}) {
  return (
    <div className="bg-[var(--background)] text-[var(--foreground)]">
      <JsonLd data={faqJsonLd()} />
      <Hero leaders={leaders} playerCount={playerCount} />
      <HowToPlay />
      <TierLadder />
      <FlexBadges />
      <PowerUps />
      <CoOp stats={repoStats} />
      <Faq />
      <Continue />
    </div>
  );
}
