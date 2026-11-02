import { renderToString } from "react-dom/server";
import { LazyMotion, domAnimation } from "motion/react";
import { describe, expect, it } from "vitest";
import TierBadge from "@/components/gamification/TierBadge";
import XpBar from "@/components/gamification/XpBar";
import LevelChip from "@/components/gamification/LevelChip";
import RankMovementBadge from "@/components/gamification/RankMovementBadge";
import { levelFromXp } from "@/lib/gamification/scoring";

const ssr = (node: React.ReactNode) =>
  renderToString(
    <LazyMotion features={domAnimation} strict>
      {node}
    </LazyMotion>
  );

describe("TierBadge", () => {
  it("names the tier and score for screen readers", () => {
    const html = ssr(<TierBadge tier="gold" score={512} />);
    expect(html).toContain('aria-label="Gold tier · score 512 / 1000"');
    expect(html).toContain("Gold");
  });

  it("only gives Legend the shimmer", () => {
    expect(ssr(<TierBadge tier="legend" />)).toContain("tier-legend");
    expect(ssr(<TierBadge tier="diamond" />)).not.toContain("tier-legend");
  });

  it("carries the reduced-motion fallback hook", () => {
    expect(ssr(<TierBadge tier="silver" />)).toContain("data-reveal");
  });
});

describe("XpBar", () => {
  it("exposes progress as an accessible progressbar", () => {
    const xp = 39185;
    const { level, current, needed } = levelFromXp(xp);
    const html = ssr(<XpBar xp={xp} />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain(`aria-valuenow="${current}"`);
    expect(html).toContain(`aria-valuemax="${needed}"`);
    expect(html).toContain(`Level ${level} progress`);
  });

  it("sizes the fill to the real progress, so the resting state is correct", () => {
    const { fraction } = levelFromXp(39185);
    expect(ssr(<XpBar xp={39185} />)).toContain(
      `width:${Math.round(fraction * 100)}%`
    );
  });

  it("server-renders the real XP, not zero", () => {
    expect(ssr(<XpBar xp={39185} />)).toContain("39,185");
  });
});

describe("LevelChip and RankMovementBadge", () => {
  it("labels the level", () => {
    expect(renderToString(<LevelChip level={24} />)).toContain(
      'aria-label="Level 24"'
    );
  });

  it("spells out movement for screen readers", () => {
    expect(
      renderToString(<RankMovementBadge movement={{ kind: "up", places: 3 }} />)
    ).toContain('aria-label="Up 3 places"');
    expect(
      renderToString(
        <RankMovementBadge movement={{ kind: "down", places: 1 }} />
      )
    ).toContain('aria-label="Down 1 place"');
    expect(
      renderToString(<RankMovementBadge movement={{ kind: "new" }} />)
    ).toContain("New");
  });

  it("renders nothing without a baseline", () => {
    expect(
      renderToString(<RankMovementBadge movement={{ kind: "none" }} />)
    ).toBe("");
  });
});
