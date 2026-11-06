import "./setup";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * New accounts start on the public leaderboard; returning accounts keep
 * their choice.
 */
const mocks = vi.hoisted(() => ({
  existing: null as { id: string } | null,
  update: vi.fn(),
  clearLeaderboardCache: vi.fn(),
  submitToIndexNow: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  isSupabaseAdminAvailable: true,
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mocks.existing, error: null }),
        }),
      }),
      upsert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "user-1" }, error: null }),
        }),
      }),
      update: (values: unknown) => {
        mocks.update(values);
        return { eq: async () => ({ error: null }) };
      },
    }),
  },
}));
vi.mock("@/lib/github-achievements", () => ({
  syncGitHubAchievementsForUser: vi.fn(),
}));
vi.mock("@/lib/leaderboard", () => ({
  clearLeaderboardCache: mocks.clearLeaderboardCache,
}));
vi.mock("@/lib/indexnow", () => ({
  submitToIndexNow: mocks.submitToIndexNow,
}));

let signIn: (args: unknown) => Promise<boolean>;

beforeAll(async () => {
  process.env.NEXTAUTH_SECRET = "test-secret";
  const mod = await import("../src/lib/auth");
  signIn = mod.authOptions.callbacks!.signIn as never;
});

const githubSignIn = () =>
  signIn({
    account: { provider: "github" },
    profile: { id: 4242, login: "NewDev" },
    user: {},
  });

describe("first sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("puts a new account on the public leaderboard", async () => {
    mocks.existing = null;
    expect(await githubSignIn()).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_public: true, leaderboard_opt_in: true })
    );
    expect(mocks.clearLeaderboardCache).toHaveBeenCalledOnce();
    expect(mocks.submitToIndexNow).toHaveBeenCalledWith(["/u/newdev"]);
  });

  it("leaves a returning account's visibility alone", async () => {
    mocks.existing = { id: "user-1" };
    expect(await githubSignIn()).toBe(true);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.clearLeaderboardCache).not.toHaveBeenCalled();
  });
});
