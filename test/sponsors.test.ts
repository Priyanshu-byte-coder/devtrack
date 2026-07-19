import "./setup";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabaseAdmin
const mockUpsert = vi.fn();
const mockSingle = vi.fn();
vi.mock("@/lib/supabase", () => ({
  isSupabaseAdminAvailable: true,
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: () => mockSingle(),
        }),
      }),
      upsert: (...args: any[]) => {
        mockUpsert(...args);
        return { error: null };
      },
    }),
  },
}));

// Mock githubGraphQL
const mockGithubGraphQL = vi.fn();
vi.mock("@/lib/github-fetch", () => ({
  githubGraphQL: (...args: any[]) => mockGithubGraphQL(...args),
  githubAuthErrorResponse: () => new Response(JSON.stringify({ error: "token_expired" }), { status: 401 }),
}));

import { syncSponsorMetricsForUser, getCachedSponsorMetrics } from "../src/lib/sponsors";

describe("GitHub Sponsors Sync & Calculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCachedSponsorMetrics", () => {
    it("returns cached metrics from Supabase", async () => {
      const mockCachedData = {
        mrr: 120,
        active_count: 5,
        growth_trend: 25.0,
        sparkline_data: [{ month: "Jan", count: 4 }, { month: "Feb", count: 5 }],
        sponsors_json: [{ login: "user1", name: "User One", privacyLevel: "PUBLIC" }],
        synced_at: "2026-06-11T12:00:00Z",
      };
      mockSingle.mockResolvedValueOnce({ data: mockCachedData, error: null });

      const res = await getCachedSponsorMetrics("user-uuid-123");

      expect(res).toBeDefined();
      expect(res?.mrr).toBe(120);
      expect(res?.activeCount).toBe(5);
      expect(res?.growthTrend).toBe(25.0);
      expect(res?.sponsors).toHaveLength(1);
      expect(res?.sponsors[0].login).toBe("user1");
    });

    it("returns null if no cached metrics exist", async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
      const res = await getCachedSponsorMetrics("user-uuid-123");
      expect(res).toBeNull();
    });
  });

  describe("syncSponsorMetricsForUser", () => {
    it("returns cached data without fetching if cache is fresh", async () => {
      const freshCachedData = {
        mrr: 150,
        active_count: 6,
        growth_trend: 10.0,
        sparkline_data: [],
        sponsors_json: [],
        synced_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago (fresh)
      };
      mockSingle.mockResolvedValueOnce({ data: freshCachedData, error: null });

      const res = await syncSponsorMetricsForUser({
        userId: "user-uuid-123",
        token: "github-token-abc",
      });

      expect(res.mrr).toBe(150);
      expect(res.activeCount).toBe(6);
      expect(mockGithubGraphQL).not.toHaveBeenCalled();
    });

    it("fetches, processes, and caches sponsors when force-synced or cache is stale", async () => {
      // Stale cache (40 mins ago)
      const staleCachedData = {
        mrr: 150,
        active_count: 6,
        growth_trend: 10.0,
        sparkline_data: [],
        sponsors_json: [],
        synced_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      };
      mockSingle.mockResolvedValueOnce({ data: staleCachedData, error: null });

      // Mock GitHub response
      mockGithubGraphQL.mockResolvedValueOnce({
        viewer: {
          sponsorshipsAsMaintainer: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              {
                createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago (active)
                isActive: true,
                privacyLevel: "PUBLIC",
                tier: {
                  monthlyPriceInCents: 5000,
                  name: "Gold Tier",
                },
                sponsorEntity: {
                  login: "sponsor1",
                  name: "Sponsor One",
                  url: "https://github.com/sponsor1",
                  avatarUrl: "https://avatars/1.png",
                },
              },
              {
                createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago (private)
                isActive: true,
                privacyLevel: "PRIVATE",
                tier: {
                  monthlyPriceInCents: 2000,
                  name: "Silver Tier",
                },
                sponsorEntity: {
                  login: "sponsor2",
                  name: "Sponsor Two",
                  url: "https://github.com/sponsor2",
                  avatarUrl: "https://avatars/2.png",
                },
              },
              {
                createdAt: new Date().toISOString(), // Inactive
                isActive: false,
                privacyLevel: "PUBLIC",
                tier: {
                  monthlyPriceInCents: 1000,
                  name: "Bronze Tier",
                },
                sponsorEntity: {
                  login: "sponsor3",
                  name: "Sponsor Three",
                  url: "https://github.com/sponsor3",
                },
              },
            ],
          },
        },
      });

      const res = await syncSponsorMetricsForUser({
        userId: "user-uuid-123",
        token: "github-token-abc",
        force: true,
      });

      // Assert calculations
      expect(res.mrr).toBe(70); // 5000 + 2000 cents = $70
      expect(res.activeCount).toBe(2);

      // Verify privacy compliance for the private sponsor
      const pubSponsor = res.sponsors.find((s) => s.privacyLevel === "PUBLIC");
      const privSponsor = res.sponsors.find((s) => s.privacyLevel === "PRIVATE");

      expect(pubSponsor?.name).toBe("Sponsor One");
      expect(pubSponsor?.login).toBe("sponsor1");
      expect(pubSponsor?.avatarUrl).toBe("https://avatars/1.png");

      expect(privSponsor?.name).toBe("Private Sponsor");
      expect(privSponsor?.login).toBe("private-sponsor");
      expect(privSponsor?.url).toBeNull();
      expect(privSponsor?.avatarUrl).toBeNull();

      // Verify database upsert
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-uuid-123",
          mrr: 70,
          active_count: 2,
        }),
        { onConflict: "user_id" }
      );
    });
  });
});
