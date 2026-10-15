process.env.TZ = "UTC";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.NEXTAUTH_SECRET = "test-secret";
process.env.GITHUB_ID = "test-github-id";
process.env.GITHUB_SECRET = "test-github-secret";

import { beforeEach, vi } from "vitest";
vi.mock("server-only", () => ({}));

// Route unit tests stub the transport boundary. Dedicated transport tests unmock it.
vi.mock("@/lib/github-request", async () => {
  const { commitTimelineShim } = await import("./commit-timeline-shim");
  return { githubRequest: commitTimelineShim };
});

// The commit timeline is memoized per process; each test starts from its own mocks.
beforeEach(async () => {
  const search = await import("@/lib/github-search").catch(() => null);
  if (search && typeof search.resetCommitTimelines === "function")
    search.resetCommitTimelines();
});

vi.mock("@/lib/safe-webhook-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/safe-webhook-fetch")>()),
  safeWebhookFetch: (input: string, init?: RequestInit) => fetch(input, init),
}));
