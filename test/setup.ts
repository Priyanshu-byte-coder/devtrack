process.env.TZ = 'UTC';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.GITHUB_ID = 'test-github-id';
process.env.GITHUB_SECRET = 'test-github-secret';

import { vi } from "vitest";
vi.mock("server-only", () => ({}));


// Route unit tests stub the transport boundary. Dedicated transport tests unmock it.
vi.mock("@/lib/github-request", () => ({
  githubRequest: (input: string | URL | Request, init?: RequestInit) => fetch(input, init),
}));

vi.mock("@/lib/safe-webhook-fetch", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/safe-webhook-fetch")>(),
  safeWebhookFetch: (input: string, init?: RequestInit) => fetch(input, init),
}));
