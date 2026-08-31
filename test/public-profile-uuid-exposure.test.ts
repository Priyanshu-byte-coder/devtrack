import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPublicProfile } from "@/lib/public-profile-data";
import { GET } from "@/app/api/public/[username]/route";
import { NextRequest } from "next/server";

// ─── hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getUserByUsername: vi.fn(),
  syncGitHubAchievementsForUser: vi.fn(),
  fetchPinnedRepoDetails: vi.fn(),
  // route-level mocks
  fetchPublicProfileRoute: vi.fn(),
  getUpstashConfig: vi.fn(() => null),
}));

// The first describe block tests the library function directly, so it needs
// the real implementation with mocked dependencies.
vi.mock("@/lib/supabase", () => ({
  getUserByUsername: mocks.getUserByUsername,
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  },
  isSupabaseAdminAvailable: true,
  SUPABASE_ADMIN_UNAVAILABLE_MESSAGE: "",
  getUserByGithubId: vi.fn(),
  updateUserPublicFlag: vi.fn(),
}));

vi.mock("@/lib/github-achievements", () => ({
  syncGitHubAchievementsForUser: mocks.syncGitHubAchievementsForUser,
  getCachedGitHubAchievements: vi.fn(),
}));

vi.mock("@/lib/pinned-repos", () => ({
  fetchPinnedRepoDetails: mocks.fetchPinnedRepoDetails,
}));

vi.mock("@/lib/upstash-rest", () => ({
  getUpstashConfig: mocks.getUpstashConfig,
  upstashRateLimitFixedWindow: vi.fn(),
}));

// ─── constants ───────────────────────────────────────────────────────────────

const APP_UUID = "550e8400-e29b-41d4-a716-446655440000";

const MOCK_USER = {
  id: APP_UUID,
  github_login: "alice",
  github_id: "12345",
  is_public: true,
  is_sponsor: false,
  bio: "Hello world",
  pinned_repos: [],
};

// fetchPublicTopLanguages calls /users/{login}/repos and expects an array.
// All other GitHub API calls used by fetchPublicProfile return { items, total_count }.
function makeGhFetchStub() {
  return vi.fn().mockImplementation((url: string) => {
    const isReposEndpoint =
      typeof url === "string" && url.includes("/users/") && url.includes("/repos");
    return Promise.resolve({
      ok: true,
      json: async () => (isReposEndpoint ? [] : { items: [], total_count: 0 }),
    });
  });
}

// ─── tests for fetchPublicProfile ────────────────────────────────────────────

describe("fetchPublicProfile — UUID exposure (regression for #1749)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getUserByUsername.mockResolvedValue(MOCK_USER);
    mocks.syncGitHubAchievementsForUser.mockResolvedValue({
      achievements: [],
      syncedAt: null,
      error: null,
    });
    mocks.fetchPinnedRepoDetails.mockResolvedValue([]);

    vi.stubGlobal("fetch", makeGhFetchStub());
  });

  it("does not include userId in the returned profile", async () => {
    const profile = await fetchPublicProfile("alice");
    expect(profile).not.toBeNull();
    expect(Object.keys(profile!)).not.toContain("userId");
  });

  it("does not include the Supabase UUID value anywhere in the serialised response", async () => {
    const profile = await fetchPublicProfile("alice");
    expect(profile).not.toBeNull();
    // A UUID present in any field of the JSON would be a data exposure
    const serialised = JSON.stringify(profile);
    expect(serialised).not.toContain(APP_UUID);
  });

  it("still returns all expected public fields", async () => {
    const profile = await fetchPublicProfile("alice");
    expect(profile).not.toBeNull();
    expect(profile!.username).toBe("alice");
    expect(profile!.bio).toBe("Hello world");
    expect(profile!.isSponsor).toBe(false);
    expect(Array.isArray(profile!.repos)).toBe(true);
    expect(profile!.contributions).toBeDefined();
    expect(profile!.streak).toBeDefined();
    expect(Array.isArray(profile!.topLanguages)).toBe(true);
    expect(typeof profile!.pullRequests).toBe("number");
    expect(Array.isArray(profile!.achievements)).toBe(true);
  });

  it("returns null when the user is not found", async () => {
    mocks.getUserByUsername.mockResolvedValue(null);
    const profile = await fetchPublicProfile("nobody");
    expect(profile).toBeNull();
  });

  it("still passes user.id to syncGitHubAchievementsForUser for its own DB operations", async () => {
    // The achievements sync must still receive the internal UUID so it can
    // look up / write the cache row — only the *response payload* must not
    // expose it.
    await fetchPublicProfile("alice", { includeAchievements: true });
    expect(mocks.syncGitHubAchievementsForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: APP_UUID })
    );
  });
});

// ─── tests for the API route ─────────────────────────────────────────────────

describe("GET /api/public/[username] — response schema (regression for #1749)", () => {
  const SAFE_PROFILE = {
    username: "alice",
    bio: null,
    isSponsor: false,
    repos: [],
    contributions: { days: 30, total: 0, data: {} },
    streak: { current: 0, longest: 0, lastCommitDate: null, totalActiveDays: 0 },
    topLanguages: [],
    pullRequests: 0,
    achievements: [],
    achievementsError: null,
    spotlightRepos: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // fetchPublicProfile is called by the route; stub it to return SAFE_PROFILE
    mocks.getUserByUsername.mockResolvedValue(MOCK_USER);
    mocks.syncGitHubAchievementsForUser.mockResolvedValue({
      achievements: [],
      syncedAt: null,
      error: null,
    });
    mocks.fetchPinnedRepoDetails.mockResolvedValue([]);
    vi.stubGlobal("fetch", makeGhFetchStub());
  });

  it("responds 200 and does not include userId in the JSON body", async () => {
    const req = new NextRequest("http://localhost/api/public/alice");
    const res = await GET(req, { params: Promise.resolve({ username: "alice" }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).not.toHaveProperty("userId");
    expect(body.username).toBe("alice");
    expect(body).toHaveProperty("repos");
    expect(body).toHaveProperty("streak");
  });

  it("does not expose the UUID value in the API response body", async () => {
    const req = new NextRequest("http://localhost/api/public/alice");
    const res = await GET(req, { params: Promise.resolve({ username: "alice" }) });
    const body = await res.text();
    expect(body).not.toContain(APP_UUID);
  });

  it("responds 404 when the profile is not found", async () => {
    mocks.getUserByUsername.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/public/nobody");
    const res = await GET(req, { params: Promise.resolve({ username: "nobody" }) });
    expect(res.status).toBe(404);
  });
});
