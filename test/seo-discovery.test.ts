import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { INDEXNOW_KEY, indexNowPayload } from "@/lib/indexnow";
import {
  TOP_COUNTRIES,
  TOP_LANGUAGES,
  boardQuery,
  findTopCountry,
} from "@/lib/top-developers";
import { GUIDES } from "@/content/guides";

describe("indexNowPayload", () => {
  it("makes paths absolute, dedupes and keeps our host only", () => {
    const payload = indexNowPayload([
      "/u/octocat",
      "/u/octocat",
      "https://devtrack.live/top",
      "https://evil.example/x",
    ]);
    expect(payload.urlList).toEqual([
      "https://devtrack.live/u/octocat",
      "https://devtrack.live/top",
    ]);
    expect(payload.keyLocation).toBe(
      `https://devtrack.live/${INDEXNOW_KEY}.txt`
    );
  });
});

describe("top developer boards", () => {
  it("queries languages and countries, quoting multi-word values", () => {
    expect(boardQuery(TOP_LANGUAGES[0])).toBe(
      "language:JavaScript type:user followers:>100 sort:followers-desc"
    );
    expect(boardQuery(findTopCountry("india")!)).toBe(
      "location:India type:user followers:>100 sort:followers-desc"
    );
    expect(boardQuery(findTopCountry("united-states")!)).toContain(
      'location:"United States"'
    );
  });

  it("has unique, URL-safe country slugs", () => {
    const slugs = TOP_COUNTRIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });
});

describe("guides", () => {
  it("have unique slugs, dates and quick answers", () => {
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const guide of GUIDES) {
      expect(guide.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(guide.description.length).toBeLessThanOrEqual(170);
      expect(guide.updated >= guide.published).toBe(true);
      expect(guide.faq.length).toBeGreaterThan(0);
    }
  });
});
