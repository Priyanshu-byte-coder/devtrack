import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { POST } from "@/app/api/local-coding/keys/route";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  from: vi.fn(),
  countEq: vi.fn(),
  insert: vi.fn(),
  insertSelect: vi.fn(),
  insertSingle: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/resolve-user", () => ({
  resolveAppUser: mocks.resolveAppUser,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}));

function createRequest(name: string) {
  return new NextRequest("http://localhost/api/local-coding/keys", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

describe("Local Coding Keys POST API Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getServerSession.mockResolvedValue({
      githubId: "12345",
      githubLogin: "test-user",
    });
    mocks.resolveAppUser.mockResolvedValue({ id: "user-1" });
    mocks.countEq.mockResolvedValue({ count: 0, error: null });
    mocks.insertSingle.mockResolvedValue({
      data: {
        id: "key-1",
        name: "Laptop",
        last_used_at: null,
        created_at: "2026-05-29T00:00:00.000Z",
      },
      error: null,
    });

    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: mocks.countEq }),
      insert: mocks.insert,
    });
    mocks.insert.mockReturnValue({ select: mocks.insertSelect });
    mocks.insertSelect.mockReturnValue({ single: mocks.insertSingle });
  });

  it("stores the hash in both api_key and api_key_hash", async () => {
    const res = await POST(createRequest("  Laptop  "));
    const body = await res.json();
    const returnedApiKey = body.key.api_key;
    // lgtm[js/insufficient-password-hash] - SHA-256 is appropriate for hashing high-entropy random API keys in tests
    const expectedHash = createHash("sha256").update(returnedApiKey).digest("hex");

    expect(res.status).toBe(200);
    // Both columns must receive the same hash so that either code path
    // (api_key_hash-based OR api_key-based lookup) can authenticate the key.
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      api_key: expect.any(String),
      api_key_hash: expectedHash,
      name: "Laptop",
    });
    expect(body.message).toContain("Store this API key securely");
  });
});
