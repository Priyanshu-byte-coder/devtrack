/**
 * Clearing the leaderboard cache must expire the Next.js data cache at once.
 * `revalidateTag(tag, {})` is stale-while-revalidate, which showed the old
 * board to the first visitor after someone joined.
 */
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ revalidateTag: vi.fn() }));

vi.mock("@/lib/github-request", () => ({ githubRequest: vi.fn() }));
vi.mock("@/lib/crypto", () => ({ decryptToken: vi.fn(() => null) }));
vi.mock("@/lib/metrics-cache", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDelete: vi.fn(),
  invalidateLeaderboardCache: vi.fn(),
}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: mocks.revalidateTag,
}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: vi.fn() } }));

import { clearLeaderboardCache } from "@/lib/leaderboard";

describe("clearLeaderboardCache", () => {
  it("expires the leaderboard tag immediately", async () => {
    await clearLeaderboardCache();
    expect(mocks.revalidateTag).toHaveBeenCalledWith("leaderboard", {
      expire: 0,
    });
  });
});
