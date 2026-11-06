import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  renderRankBadge,
  type RankBadgeData,
} from "@/lib/gamification/rank-badge";
import { pixelTextPath, pixelTextWidth } from "@/lib/gamification/pixel-font";

const ranked: RankBadgeData = {
  state: "ranked",
  board: "all",
  rank: 1,
  total: 5,
  tier: "legend",
  scoreV2: 929,
  level: 54,
  levelProgress: 0.55,
  movement: { kind: "up", places: 2 },
};

function parse(svg: string) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  return doc.documentElement;
}

describe("renderRankBadge", () => {
  it("produces well-formed SVG with real dimensions", () => {
    const root = parse(renderRankBadge(ranked));
    expect(root.tagName).toBe("svg");
    expect(Number(root.getAttribute("width"))).toBeGreaterThan(150);
    expect(Number(root.getAttribute("height"))).toBe(64);
  });

  it("describes the rank for screen readers", () => {
    const svg = renderRankBadge(ranked);
    expect(svg).toContain(
      'aria-label="DevTrack: #1 of 5 globally, Legend tier, level 54"'
    );
    expect(svg).toContain("<title>DevTrack: #1 of 5 globally");
  });

  it("names the board in the description", () => {
    expect(renderRankBadge({ ...ranked, board: "month" })).toContain(
      "this season"
    );
    expect(renderRankBadge({ ...ranked, board: "week" })).toContain(
      "this week"
    );
  });

  it("is self-contained: no fonts, external images or links", () => {
    for (const svg of [
      renderRankBadge(ranked),
      renderRankBadge({ state: "unranked" }),
    ]) {
      expect(svg).not.toMatch(
        /<text|font-family|<image|href=|@import|<script/i
      );
    }
  });

  it("only uses finite animations", () => {
    const svg = renderRankBadge(ranked);
    expect(svg).toContain("<animate");
    expect(svg).not.toContain("indefinite");
  });

  it("renders an unranked badge without any personal detail", () => {
    const svg = renderRankBadge({ state: "unranked" });
    parse(svg);
    expect(svg).toContain("not ranked yet");
  });

  it("handles a missing level and every movement kind", () => {
    for (const movement of [
      { kind: "down", places: 3 },
      { kind: "new" },
      { kind: "same" },
      { kind: "none" },
    ] as const) {
      parse(
        renderRankBadge({
          ...ranked,
          level: null,
          levelProgress: null,
          movement,
        })
      );
    }
  });
});

describe("pixel font", () => {
  it("measures text in font pixels times scale", () => {
    // 3 glyphs: 3 x 6 advance - 1 trailing gap = 17, x2.
    expect(pixelTextWidth("ABC", 2)).toBe(34);
    expect(pixelTextWidth("", 2)).toBe(0);
  });

  it("draws unknown characters as a visible fallback, not nothing", () => {
    expect(pixelTextPath("~", 0, 0, 1).length).toBeGreaterThan(0);
  });
});

// ── Route ───────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({ getRankBadgeRow: vi.fn() }));
vi.mock("@/lib/gamification/queries", () => ({
  getRankBadgeRow: mocks.getRankBadgeRow,
}));

const req = (qs: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost/api/badge/rank?${qs}`, { headers });

describe("GET /api/badge/rank", () => {
  beforeEach(() => {
    mocks.getRankBadgeRow.mockReset();
    mocks.getRankBadgeRow.mockResolvedValue({
      rank: 2,
      total: 13,
      tier: "gold",
      scoreV2: 612,
      previousRank: 4,
      hasPrevious: true,
      level: 21,
      xp: 9240,
    });
  });

  it("serves the ranked badge with explicit caching and a sandboxing CSP", async () => {
    const { GET } = await import("@/app/api/badge/rank/route");
    const res = await GET(req("user=octocat"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    expect(res.headers.get("cache-control")).toContain("max-age=300");
    expect(res.headers.get("etag")).toMatch(/^".+"$/);
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    expect(await res.text()).toContain("#2 of 13 globally");
  });

  it("answers 304 when the badge hasn't changed", async () => {
    const { GET } = await import("@/app/api/badge/rank/route");
    const first = await GET(req("user=octocat"));
    const etag = first.headers.get("etag")!;
    const second = await GET(req("user=octocat", { "if-none-match": etag }));
    expect(second.status).toBe(304);
  });

  it("passes the chosen board through and ignores unknown ones", async () => {
    const { GET } = await import("@/app/api/badge/rank/route");
    await GET(req("user=octocat&board=month"));
    expect(mocks.getRankBadgeRow).toHaveBeenLastCalledWith("octocat", "month");
    await GET(req("user=octocat&board=bogus"));
    expect(mocks.getRankBadgeRow).toHaveBeenLastCalledWith("octocat", "all");
  });

  it("shows 'not ranked yet' for people who aren't public or on the board", async () => {
    mocks.getRankBadgeRow.mockResolvedValue(null);
    const { GET } = await import("@/app/api/badge/rank/route");
    const res = await GET(req("user=private-person"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("not ranked yet");
  });

  it("rejects invalid usernames without touching the database", async () => {
    const { GET } = await import("@/app/api/badge/rank/route");
    const res = await GET(req("user=../../etc"));
    expect(res.status).toBe(400);
    expect(mocks.getRankBadgeRow).not.toHaveBeenCalled();
  });
});
