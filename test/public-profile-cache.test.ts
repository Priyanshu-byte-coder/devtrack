import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const cacheStore = new Map<string, any>();
  const unstableCacheCalls: Array<{
    keyParts: string[];
    options?: { revalidate?: number | false; tags?: string[] };
  }> = [];

  const mockUnstableCache = vi.fn(
    <T extends (...args: any[]) => Promise<any>>(
      cb: T,
      keyParts?: string[],
      options?: { revalidate?: number | false; tags?: string[] }
    ): T => {
      const cacheKey = (keyParts || []).join(":");
      unstableCacheCalls.push({ keyParts: keyParts || [], options });

      return (async (...args: any[]) => {
        if (cacheStore.has(cacheKey)) {
          return cacheStore.get(cacheKey);
        }
        // If loader throws, the error propagates and nothing is stored in cache
        const result = await cb(...args);
        cacheStore.set(cacheKey, result);
        return result;
      }) as T;
    }
  );

  return {
    cacheStore,
    unstableCacheCalls,
    mockUnstableCache,
    fetchPublicProfile: vi.fn(),
    filterPublicProfileData: vi.fn((profile: any) => ({
      ...profile,
      _filtered: true,
    })),
    getRegistration: vi.fn(),
    getGuestProfile: vi.fn(),
    reactCache: vi.fn((fn: any) => fn),
  };
});

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: mocks.reactCache,
  };
});

vi.mock("next/cache", () => ({
  unstable_cache: mocks.mockUnstableCache,
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/public-profile-data", () => ({
  fetchPublicProfile: mocks.fetchPublicProfile,
  filterPublicProfileData: mocks.filterPublicProfileData,
}));

vi.mock("@/lib/guest-profile", () => ({
  getRegistration: mocks.getRegistration,
  getGuestProfile: mocks.getGuestProfile,
}));

import {
  getPublicProfileForPage,
  getProfileForPage,
} from "@/lib/public-profile-cache";
import type { PublicProfileData } from "@/lib/public-profile-data";
import type { GuestProfile } from "@/lib/guest-profile-model";

const SAMPLE_PROFILE: PublicProfileData = {
  user: {
    login: "alice",
    name: "Alice Smith",
    bio: "Full stack engineer",
    avatarUrl: "https://avatars.githubusercontent.com/u/123",
    followers: 42,
    following: 10,
    publicRepos: 15,
    publicGists: 2,
    createdAt: "2020-01-01T00:00:00Z",
  },
  stats: {
    totalCommits: 350,
    totalPRs: 25,
    totalIssues: 10,
    totalStars: 99,
    streak: { current: 5, longest: 14 },
  },
  publicWidgets: ["streak", "contributions"],
} as unknown as PublicProfileData;

const SAMPLE_GUEST: GuestProfile = {
  user: {
    login: "bob-guest",
    name: "Bob Guest",
    bio: "Open source contributor",
    avatarUrl: "https://avatars.githubusercontent.com/u/456",
    followers: 12,
    following: 5,
    publicRepos: 8,
    publicGists: 0,
    createdAt: "2021-06-01T00:00:00Z",
  },
  lifetime: {
    totalCommits: 120,
    totalPRs: 8,
    totalIssues: 4,
    totalStars: 15,
  },
} as unknown as GuestProfile;

describe("public-profile-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cacheStore.clear();
    mocks.unstableCacheCalls.length = 0;

    // Default: fetchPublicProfile returns SAMPLE_PROFILE
    mocks.fetchPublicProfile.mockResolvedValue(SAMPLE_PROFILE);
    mocks.filterPublicProfileData.mockImplementation((profile) => ({
      ...profile,
      _filtered: true,
    }));

    // Default: registration null, guest profile null
    mocks.getRegistration.mockResolvedValue(null);
    mocks.getGuestProfile.mockResolvedValue(null);
  });

  describe("getPublicProfileForPage", () => {
    it("returns null for invalid usernames without invoking loader or cache", async () => {
      const invalidUsernames = [
        "",
        "-invalid",
        "invalid-",
        "user/name",
        "user@name",
        "a".repeat(40),
      ];

      for (const username of invalidUsernames) {
        const result = await getPublicProfileForPage(username);
        expect(result).toBeNull();
      }

      expect(mocks.fetchPublicProfile).not.toHaveBeenCalled();
      expect(mocks.mockUnstableCache).not.toHaveBeenCalled();
    });

    it("handles cache miss: calls fetchPublicProfile with lowercase username and includeAchievements, filters data", async () => {
      const result = await getPublicProfileForPage("Alice");

      expect(result).toEqual({
        ...SAMPLE_PROFILE,
        _filtered: true,
      });

      expect(mocks.fetchPublicProfile).toHaveBeenCalledTimes(1);
      expect(mocks.fetchPublicProfile).toHaveBeenCalledWith("alice", {
        includeAchievements: true,
      });
      expect(mocks.filterPublicProfileData).toHaveBeenCalledWith(
        SAMPLE_PROFILE
      );
    });

    it("configures unstable_cache with correct keyParts, TTL, and cache tags", async () => {
      await getPublicProfileForPage("Alice");

      expect(mocks.unstableCacheCalls.length).toBeGreaterThan(0);
      const call = mocks.unstableCacheCalls[0];

      expect(call.keyParts).toEqual(["public-profile-page", "alice"]);
      expect(call.options).toEqual({
        revalidate: 7200, // PROFILE_TTL_SECONDS = 2 * 60 * 60 = 7200
        tags: ["public-profile:alice"],
      });
    });

    it("handles cache hit: second call with same normalized username returns cached result without re-invoking loader", async () => {
      // First call: cache miss
      const first = await getPublicProfileForPage("alice");
      expect(first).toEqual({ ...SAMPLE_PROFILE, _filtered: true });
      expect(mocks.fetchPublicProfile).toHaveBeenCalledTimes(1);

      // Second call: cache hit
      const second = await getPublicProfileForPage("alice");
      expect(second).toEqual(first);
      // fetchPublicProfile should NOT be called again
      expect(mocks.fetchPublicProfile).toHaveBeenCalledTimes(1);
    });

    it("normalizes case variations to the same cache key without re-fetching", async () => {
      const res1 = await getPublicProfileForPage("OctoCat");
      const res2 = await getPublicProfileForPage("OCTOCAT");
      const res3 = await getPublicProfileForPage("octocat");

      expect(res1).toEqual(res2);
      expect(res2).toEqual(res3);
      expect(mocks.fetchPublicProfile).toHaveBeenCalledTimes(1);
      expect(mocks.fetchPublicProfile).toHaveBeenCalledWith("octocat", {
        includeAchievements: true,
      });
    });

    it("returns null when fetchPublicProfile returns null (user not found / private)", async () => {
      mocks.fetchPublicProfile.mockResolvedValue(null);

      const result = await getPublicProfileForPage("ghost-user");

      expect(result).toBeNull();
      expect(mocks.filterPublicProfileData).not.toHaveBeenCalled();
    });

    it("propagates loader errors and does not cache failures", async () => {
      mocks.fetchPublicProfile.mockRejectedValueOnce(
        new Error("GitHub GraphQL API timeout")
      );

      // First call should fail
      await expect(getPublicProfileForPage("alice")).rejects.toThrow(
        "GitHub GraphQL API timeout"
      );

      // Verify nothing cached for this user
      expect(mocks.cacheStore.has("public-profile-page:alice")).toBe(false);

      // Subsequent call should re-invoke loader and succeed
      mocks.fetchPublicProfile.mockResolvedValueOnce(SAMPLE_PROFILE);
      const retryResult = await getPublicProfileForPage("alice");

      expect(retryResult).toEqual({
        ...SAMPLE_PROFILE,
        _filtered: true,
      });
      expect(mocks.fetchPublicProfile).toHaveBeenCalledTimes(2);
    });
  });

  describe("getProfileForPage", () => {
    it("returns null for invalid usernames", async () => {
      const result = await getProfileForPage("-invalid-user");
      expect(result).toBeNull();
      expect(mocks.getRegistration).not.toHaveBeenCalled();
      expect(mocks.getGuestProfile).not.toHaveBeenCalled();
    });

    it("returns null when user is registered but has a private profile (isPublic: false)", async () => {
      mocks.getRegistration.mockResolvedValue({ isPublic: false });

      const result = await getProfileForPage("private-member");

      expect(result).toBeNull();
      expect(mocks.getRegistration).toHaveBeenCalledWith("private-member");
      expect(mocks.getGuestProfile).not.toHaveBeenCalled();
      expect(mocks.fetchPublicProfile).not.toHaveBeenCalled();
    });

    it("returns kind: member with public profile when user is registered and isPublic: true", async () => {
      mocks.getRegistration.mockResolvedValue({ isPublic: true });
      mocks.fetchPublicProfile.mockResolvedValue(SAMPLE_PROFILE);

      const result = await getProfileForPage("public-member");

      expect(result).toEqual({
        kind: "member",
        profile: {
          ...SAMPLE_PROFILE,
          _filtered: true,
        },
      });
      expect(mocks.getRegistration).toHaveBeenCalledWith("public-member");
      expect(mocks.getGuestProfile).not.toHaveBeenCalled();
    });

    it("returns null when user is registered and isPublic: true but public profile data is null", async () => {
      mocks.getRegistration.mockResolvedValue({ isPublic: true });
      mocks.fetchPublicProfile.mockResolvedValue(null);

      const result = await getProfileForPage("member-missing-data");

      expect(result).toBeNull();
      expect(mocks.getRegistration).toHaveBeenCalledWith("member-missing-data");
    });

    it("returns kind: guest when user is not registered and has a valid guest profile", async () => {
      mocks.getRegistration.mockResolvedValue(null);
      mocks.getGuestProfile.mockResolvedValue(SAMPLE_GUEST);

      const result = await getProfileForPage("bob-guest");

      expect(result).toEqual({
        kind: "guest",
        profile: SAMPLE_GUEST,
      });
      expect(mocks.getRegistration).toHaveBeenCalledWith("bob-guest");
      expect(mocks.getGuestProfile).toHaveBeenCalledWith("bob-guest");
      expect(mocks.fetchPublicProfile).not.toHaveBeenCalled();
    });

    it("returns null when user is not registered and guest profile is null", async () => {
      mocks.getRegistration.mockResolvedValue(null);
      mocks.getGuestProfile.mockResolvedValue(null);

      const result = await getProfileForPage("non-existent-user");

      expect(result).toBeNull();
      expect(mocks.getRegistration).toHaveBeenCalledWith("non-existent-user");
      expect(mocks.getGuestProfile).toHaveBeenCalledWith("non-existent-user");
    });
  });
});
