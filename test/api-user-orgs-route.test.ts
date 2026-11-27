import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/user/orgs/route";
import { GitHubRateLimitError } from "@/lib/github-rate-limit";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  getAllAccounts: vi.fn(),
  githubRequest: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock("@/lib/server-session", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/resolve-user", () => ({
  resolveAppUser: mocks.resolveAppUser,
}));

vi.mock("@/lib/github-accounts", () => ({
  getAllAccounts: mocks.getAllAccounts,
}));

vi.mock("@/lib/github-request", () => ({
  githubRequest: mocks.githubRequest,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: mocks.supabaseFrom,
  },
}));

function createPostRequest(body: string | object): NextRequest {
  const bodyString = typeof body === "string" ? body : JSON.stringify(body);
  return new NextRequest("https://devtrack.live/api/user/orgs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyString,
  });
}

describe("/api/user/orgs route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default authenticated session
    mocks.getServerSession.mockResolvedValue({
      githubId: "gh-12345",
      githubLogin: "alice",
      accessToken: "gho_mock_primary_token",
      user: { name: "Alice Smith" },
    });

    // Default resolved app user
    mocks.resolveAppUser.mockResolvedValue({ id: "user-uuid-1" });

    // Default Supabase mock
    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  organizations_config: { "org-alpha": { hidden: false } },
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        };
      }
      return {};
    });

    // Default GitHub accounts
    mocks.getAllAccounts.mockResolvedValue([
      {
        githubId: "gh-12345",
        githubLogin: "alice",
        token: "gho_mock_primary_token",
      },
    ]);

    // Default GitHub orgs response
    mocks.githubRequest.mockResolvedValue({
      ok: true,
      headers: new Headers({
        "X-OAuth-Scopes": "repo, read:org, user",
      }),
      json: vi.fn().mockResolvedValue([
        {
          id: 101,
          login: "octo-corp",
          avatar_url: "https://avatars.githubusercontent.com/u/101?v=4",
        },
      ]),
    });
  });

  describe("GET /api/user/orgs", () => {
    it("returns 401 when session is null", async () => {
      mocks.getServerSession.mockResolvedValue(null);

      const res = await GET();
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when session has no githubId", async () => {
      mocks.getServerSession.mockResolvedValue({
        accessToken: "gho_token",
        user: { name: "No ID" },
      });

      const res = await GET();
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when session has no accessToken", async () => {
      mocks.getServerSession.mockResolvedValue({
        githubId: "gh-12345",
        user: { name: "No Token" },
      });

      const res = await GET();
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("fetches organizations across multiple accounts and returns saved config", async () => {
      mocks.getAllAccounts.mockResolvedValue([
        {
          githubId: "gh-12345",
          githubLogin: "alice",
          token: "gho_token_1",
        },
        {
          githubId: "gh-67890",
          githubLogin: "alice-work",
          token: "gho_token_2",
        },
      ]);

      mocks.githubRequest.mockImplementation(
        async (
          _url: string,
          options: { headers: { Authorization: string } }
        ) => {
          if (options.headers.Authorization.includes("gho_token_1")) {
            return {
              ok: true,
              headers: new Headers({ "X-OAuth-Scopes": "repo, read:org" }),
              json: vi.fn().mockResolvedValue([
                {
                  id: 1001,
                  login: "primary-org",
                  avatar_url:
                    "https://avatars.githubusercontent.com/u/1001?v=4",
                },
              ]),
            };
          }
          // Secondary account lacks read:org scope
          return {
            ok: true,
            headers: new Headers({ "X-OAuth-Scopes": "repo, user" }),
            json: vi.fn().mockResolvedValue([
              {
                id: 2002,
                login: "work-org",
                avatar_url: "https://avatars.githubusercontent.com/u/2002?v=4",
              },
            ]),
          };
        }
      );

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.config).toEqual({ "org-alpha": { hidden: false } });
      expect(body.accounts).toHaveLength(2);

      expect(body.accounts[0]).toEqual({
        githubId: "gh-12345",
        githubLogin: "alice",
        hasOrgScope: true,
        orgs: [
          {
            id: 1001,
            login: "primary-org",
            avatarUrl: "https://avatars.githubusercontent.com/u/1001?v=4",
          },
        ],
      });

      expect(body.accounts[1]).toEqual({
        githubId: "gh-67890",
        githubLogin: "alice-work",
        hasOrgScope: false,
        orgs: [
          {
            id: 2002,
            login: "work-org",
            avatarUrl: "https://avatars.githubusercontent.com/u/2002?v=4",
          },
        ],
      });
    });

    it("ignores error loading organizations_config and falls back to empty config", async () => {
      mocks.supabaseFrom.mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: "organizations_config column missing" },
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.config).toEqual({});
      expect(body.accounts).toHaveLength(1);
    });

    it("returns 500 when getAllAccounts throws a database error", async () => {
      mocks.getAllAccounts.mockRejectedValue(
        new Error("Database connection reset during account lookup")
      );

      const res = await GET();
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toEqual({ error: "Internal server error" });
    });

    it("handles GitHub HTTP error gracefully for individual account", async () => {
      mocks.githubRequest.mockResolvedValue({
        ok: false,
        status: 403,
      });

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.accounts).toEqual([
        {
          githubId: "gh-12345",
          githubLogin: "alice",
          orgs: [],
          hasOrgScope: false,
        },
      ]);
    });

    it("handles network rejection gracefully for individual account", async () => {
      mocks.githubRequest.mockRejectedValue(new Error("Connection refused"));

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.accounts).toEqual([
        {
          githubId: "gh-12345",
          githubLogin: "alice",
          orgs: [],
          hasOrgScope: false,
        },
      ]);
    });

    it("falls back to mocked account when resolveAppUser returns null", async () => {
      mocks.resolveAppUser.mockResolvedValue(null);

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.config).toEqual({});
      expect(body.accounts).toHaveLength(1);
      expect(body.accounts[0]).toEqual({
        githubId: "gh-12345",
        githubLogin: "alice",
        orgs: [
          {
            id: 9999,
            login: "devtrack-org",
            avatarUrl: "https://avatars.githubusercontent.com/u/9919?v=4",
          },
        ],
        hasOrgScope: false,
      });
      // Should not call githubRequest when using mocked fallback
      expect(mocks.githubRequest).not.toHaveBeenCalled();
    });

    it("returns 429 when GitHubRateLimitError is thrown", async () => {
      mocks.getAllAccounts.mockRejectedValue(
        new GitHubRateLimitError(
          {
            code: "GITHUB_RATE_LIMITED",
            message: "API rate limit exceeded",
            resetAt: new Date(Date.now() + 60000).toISOString(),
            resetAtEpoch: Math.floor(Date.now() / 1000) + 60,
          },
          60
        )
      );

      const res = await GET();
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("60");

      const body = await res.json();
      expect(body.error).toBe("GITHUB_RATE_LIMITED");
    });
  });

  describe("POST /api/user/orgs", () => {
    it("returns 401 when session is null", async () => {
      mocks.getServerSession.mockResolvedValue(null);

      const req = createPostRequest({ config: {} });
      const res = await POST(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when session has no githubId", async () => {
      mocks.getServerSession.mockResolvedValue({
        accessToken: "gho_token",
        user: { name: "No GitHub ID" },
      });

      const req = createPostRequest({ config: {} });
      const res = await POST(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns 400 when request body contains malformed JSON", async () => {
      const req = createPostRequest("{ malformed json string: true ");
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: "Invalid JSON" });
    });

    it("returns 400 when config is missing from body", async () => {
      const req = createPostRequest({});
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: "Invalid configuration" });
    });

    it("returns 400 when config is null", async () => {
      const req = createPostRequest({ config: null });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: "Invalid configuration" });
    });

    it("returns 400 when config is a primitive string", async () => {
      const req = createPostRequest({ config: "invalid-string" });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: "Invalid configuration" });
    });

    it("returns 400 when config is a primitive number", async () => {
      const req = createPostRequest({ config: 42 });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: "Invalid configuration" });
    });

    it("returns 400 when config is a boolean", async () => {
      const req = createPostRequest({ config: true });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: "Invalid configuration" });
    });

    it("returns 400 when config is an array", async () => {
      const req = createPostRequest({ config: ["org-1", "org-2"] });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: "Invalid configuration" });
    });

    it("successfully updates organizations_config in Supabase and returns success: true", async () => {
      let updatePayload: any;
      let eqField: string | undefined;
      let eqValue: string | undefined;

      mocks.supabaseFrom.mockImplementation((table: string) => {
        if (table === "users") {
          return {
            update: vi.fn().mockImplementation((payload) => {
              updatePayload = payload;
              return {
                eq: vi.fn().mockImplementation((field, val) => {
                  eqField = field;
                  eqValue = val;
                  return Promise.resolve({ error: null });
                }),
              };
            }),
          };
        }
        return {};
      });

      const validConfig = {
        "org-alpha": { hidden: false, defaultRepo: "main-repo" },
        "org-beta": { hidden: true },
      };

      const req = createPostRequest({ config: validConfig });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true });

      expect(mocks.resolveAppUser).toHaveBeenCalledWith("gh-12345", "alice");
      expect(updatePayload.organizations_config).toEqual(validConfig);
      expect(updatePayload.updated_at).toBeDefined();
      expect(eqField).toBe("id");
      expect(eqValue).toBe("user-uuid-1");
    });

    it("returns 500 when Supabase update fails with database error", async () => {
      mocks.supabaseFrom.mockImplementation((table: string) => {
        if (table === "users") {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                error: { message: "violates check constraint" },
              }),
            }),
          };
        }
        return {};
      });

      const req = createPostRequest({
        config: { "org-1": { hidden: true } },
      });
      const res = await POST(req);

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: "Failed to save configuration" });
    });

    it("gracefully succeeds without Supabase write when resolveAppUser returns null", async () => {
      mocks.resolveAppUser.mockResolvedValue(null);

      const req = createPostRequest({
        config: { "org-1": { hidden: true } },
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true });

      // Supabase update should not be attempted
      expect(mocks.supabaseFrom).not.toHaveBeenCalled();
    });

    it("returns 429 when GitHubRateLimitError is thrown during POST", async () => {
      mocks.resolveAppUser.mockRejectedValue(
        new GitHubRateLimitError(
          {
            code: "GITHUB_RATE_LIMITED",
            message: "API rate limit exceeded",
            resetAt: new Date(Date.now() + 30000).toISOString(),
            resetAtEpoch: Math.floor(Date.now() / 1000) + 30,
          },
          30
        )
      );

      const req = createPostRequest({ config: {} });
      const res = await POST(req);

      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("30");
    });
  });
});
