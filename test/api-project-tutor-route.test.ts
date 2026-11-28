import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/project-tutor/route";
import { GitHubRateLimitError } from "@/lib/github-rate-limit";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  githubRequest: vi.fn(),
  groqChatCompletion: vi.fn(),
  getUpstashConfig: vi.fn(),
  upstashRateLimitFixedWindow: vi.fn(),
}));

vi.mock("@/lib/server-session", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/github-request", () => ({
  githubRequest: mocks.githubRequest,
}));

vi.mock("@/lib/groq", () => ({
  groqChatCompletion: mocks.groqChatCompletion,
}));

vi.mock("@/lib/upstash-rest", () => ({
  getUpstashConfig: mocks.getUpstashConfig,
  upstashRateLimitFixedWindow: mocks.upstashRateLimitFixedWindow,
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/project-tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockSuccessfulGitHubResponses() {
  mocks.githubRequest
    .mockResolvedValueOnce(
      jsonResponse({
        name: "demo",
        description: "Demo repository",
        topics: ["nextjs"],
        stargazers_count: 12,
      })
    )
    .mockResolvedValueOnce(
      jsonResponse({ content: "IyBEZW1vIFJFQURNRQ==" })
    )
    .mockResolvedValueOnce(
      jsonResponse({ TypeScript: 1000, CSS: 100 })
    );
}

describe("POST /api/project-tutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GROQ_API_KEY", "test-groq-key");

    mocks.getServerSession.mockResolvedValue({
      githubLogin: "alice",
      user: { email: "alice@example.com" },
    });

    mocks.getUpstashConfig.mockReturnValue(true);

    mocks.upstashRateLimitFixedWindow.mockResolvedValue({
      allowed: true,
      retryAfter: null,
    });

    mocks.groqChatCompletion.mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: "Project analysis" } }],
      })
    );
  });

  it("returns 401 when there is no session", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await POST(makeRequest({
      repoUrl: "https://github.com/acme/demo",
      action: "analyze",
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.githubRequest).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limiter rejects the request", async () => {
    mocks.upstashRateLimitFixedWindow.mockResolvedValue({
      allowed: false,
      retryAfter: 42,
    });

    const response = await POST(makeRequest({
      repoUrl: "https://github.com/acme/demo",
      action: "analyze",
    }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(await response.json()).toEqual({
      error: "Rate limit exceeded. Try again later.",
    });
    expect(mocks.githubRequest).not.toHaveBeenCalled();
  });

  it("returns 400 when the repository URL is missing", async () => {
    const response = await POST(makeRequest({ action: "analyze" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "repo URL required",
    });
    expect(mocks.githubRequest).not.toHaveBeenCalled();
  });

  it("returns 400 when the GitHub URL is invalid", async () => {
    const response = await POST(makeRequest({
      repoUrl: "https://example.com/acme/demo",
      action: "analyze",
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid GitHub URL",
    });
    expect(mocks.githubRequest).not.toHaveBeenCalled();
  });

  it("handles a GitHub rate-limit error without crashing", async () => {
    mocks.githubRequest.mockRejectedValue(
      new GitHubRateLimitError(new Date(Date.now() + 60_000), 30)
    );

    const response = await POST(makeRequest({
      repoUrl: "https://github.com/acme/demo",
      action: "analyze",
    }));

    expect(response.status).toBe(429);

    const body = await response.json();
    expect(body.error).toBe("GITHUB_RATE_LIMITED");
    expect(body.rateLimit).toHaveProperty("resetAt");
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  it("returns the expected analysis response on the happy path", async () => {
    mockSuccessfulGitHubResponses();

    const response = await POST(makeRequest({
      repoUrl: "https://github.com/acme/demo",
      action: "analyze",
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      analysis: "Project analysis",
      techStack: "TypeScript, CSS",
      description: "Demo repository",
    });

    expect(mocks.githubRequest).toHaveBeenCalledTimes(3);
    expect(mocks.groqChatCompletion).toHaveBeenCalledTimes(1);
  });
});
