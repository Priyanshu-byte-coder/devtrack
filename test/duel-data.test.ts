import { beforeEach, describe, expect, it, vi } from "vitest";

const getRegistration = vi.fn();
const getGuestProfile = vi.fn();
const getRankBadgeRow = vi.fn();
const getSavedPlayerStats = vi.fn();
const getLeaderboardData = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
}));
vi.mock("@/lib/guest-profile", () => ({
  getRegistration: (...args: unknown[]) => getRegistration(...args),
  getGuestProfile: (...args: unknown[]) => getGuestProfile(...args),
}));
vi.mock("@/lib/gamification/queries", () => ({
  getRankBadgeRow: (...args: unknown[]) => getRankBadgeRow(...args),
}));
vi.mock("@/lib/leaderboard", () => ({
  getSavedPlayerStats: (...args: unknown[]) => getSavedPlayerStats(...args),
  getLeaderboardData: (...args: unknown[]) => getLeaderboardData(...args),
}));
// The member shows every widget, so no round is hidden.
vi.mock("@/lib/supabase-admin", () => {
  const query = {
    select: () => query,
    ilike: () => query,
    limit: async () => ({
      data: [{ public_widgets: ["streak", "contributions", "prs"] }],
    }),
  };
  return {
    isSupabaseAdminAvailable: true,
    supabaseAdmin: { from: () => query },
  };
});

import { getDuelFighter } from "@/lib/duel-data";

const guest = {
  login: "dev",
  name: "Dev",
  calendar: [],
  yearContributions: 900,
  activeDays: 200,
  streak: { current: 4, longest: 30 },
  // What a public lookup sees: private-repo work is missing.
  lifetime: { commits: 1600, prs: 200, reviews: 334 },
  topLanguages: [],
};

const rankRow = {
  rank: 2,
  total: 218,
  tier: "legend",
  scoreV2: 967,
  previousRank: 2,
  hasPrevious: true,
  level: 58,
  xp: 100,
  streak: 4,
  commits: 2548,
  prs: 326,
};

describe("getDuelFighter lifetime totals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGuestProfile.mockResolvedValue(guest);
  });

  it("uses the leaderboard's totals for ranked members", async () => {
    getRegistration.mockResolvedValue({ isPublic: true });
    getRankBadgeRow.mockResolvedValue(rankRow);
    getSavedPlayerStats.mockResolvedValue({
      streak: 4,
      commits: 2548,
      prs: 326,
      activeDays: 220,
      reviews: 330,
      repos: 72,
    });

    const fighter = await getDuelFighter("dev");

    expect(getSavedPlayerStats).toHaveBeenCalledWith("dev", "all");
    expect(fighter?.stats.commits).toBe(2548);
    expect(fighter?.stats.prs).toBe(326);
    // The public count is fresher here, so it wins.
    expect(fighter?.stats.reviews).toBe(334);
  });

  it("keeps public totals when the leaderboard has nothing saved", async () => {
    getRegistration.mockResolvedValue({ isPublic: true });
    getRankBadgeRow.mockResolvedValue(rankRow);
    getSavedPlayerStats.mockResolvedValue(null);

    const fighter = await getDuelFighter("dev");

    expect(fighter?.stats.commits).toBe(1600);
    expect(fighter?.stats.prs).toBe(200);
  });

  it("uses public data for people who aren't on DevTrack", async () => {
    getRegistration.mockResolvedValue(null);
    getLeaderboardData.mockResolvedValue({ leaders: {} });

    const fighter = await getDuelFighter("dev");

    expect(getSavedPlayerStats).not.toHaveBeenCalled();
    expect(fighter?.stats.commits).toBe(1600);
  });
});
