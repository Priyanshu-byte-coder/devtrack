import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/local-coding/sync/route";
import { NextRequest } from "next/server";
import { createHash } from "crypto";

// Mock Supabase admin client methods
const mockRpc = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockKeyLookupEq = vi.fn().mockReturnValue({ single: mockSingle });
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });
const mockSessionCountEq = vi.fn();
const mockExistingDatesIn = vi.fn();
const mockExistingDatesEq = vi.fn().mockReturnValue({ in: mockExistingDatesIn });
const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
  update: mockUpdate,
});

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
    rpc: (name: string, params: any) => mockRpc(name, params),
  },
}));

describe("Local Coding Sync POST API Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSingle.mockResolvedValue({
      data: { user_id: "test-user-id" },
      error: null,
    });
    mockSessionCountEq.mockResolvedValue({ count: 5, data: null, error: null });
    mockExistingDatesIn.mockResolvedValue({ data: [], error: null });
    mockExistingDatesEq.mockReturnValue({ in: mockExistingDatesIn });

    // Setup standard mock behavior
    mockFrom.mockImplementation((table: string) => {
      if (table === "local_coding_api_keys") {
        return {
          select: vi.fn().mockReturnValue({
            eq: mockKeyLookupEq,
          }),
          update: vi.fn().mockReturnValue({
            eq: mockUpdateEq,
          }),
        };
      }
      if (table === "local_coding_sessions") {
        return {
          select: vi.fn((_columns: string, options?: { count?: string; head?: boolean }) => {
            if (options?.count) {
              return { eq: mockSessionCountEq };
            }
            return { eq: mockExistingDatesEq };
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  it("rejects request if Authorization header is missing", async () => {
    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "API key required" });
  });

  it("rejects request if API key is invalid", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "Not found" } });

    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer invalid-key",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid API key" });
  });

  it("rejects request if body is not valid JSON", async () => {
    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-key",
      },
      body: "invalid-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
  });

  it("rejects request if sessions array is missing or empty", async () => {
    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Sessions array is required" });
  });

  it("rejects request if sessions array exceeds maximum limit", async () => {
    const sessions = Array.from({ length: 101 }, () => ({
      date: "2026-05-27",
      totalSeconds: 100,
    }));
    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ sessions }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Too many sessions");
  });

  it("rejects request if any session data has an invalid date", async () => {
    const sessions = [
      { date: "2026-05-27", totalSeconds: 100 },
      { date: "invalid-date", totalSeconds: 100 },
    ];
    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ sessions }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid session data found in array" });
  });

  it("rejects request if any session data has negative seconds", async () => {
    const sessions = [{ date: "2026-05-27", totalSeconds: -50 }];
    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ sessions }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid session data found in array" });
  });

  it("rejects request if new sessions exceed user maximum limit", async () => {
    // 360 existing sessions + 10 new sessions = 370 > 365
    mockFrom.mockImplementation((table: string) => {
      if (table === "local_coding_api_keys") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockSingle.mockResolvedValue({
                data: { user_id: "test-user-id" },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "local_coding_sessions") {
        return {
          select: vi.fn((_columns: string, options?: { count?: string; head?: boolean }) => {
            if (options?.count) {
              return { eq: vi.fn().mockResolvedValue({ count: 360, data: null, error: null }) };
            }
            return {
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const sessions = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-05-${10 + i}`,
      totalSeconds: 100,
    }));
    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ sessions }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Session limit reached");
  });

  it("allows near-limit resyncs when incoming dates already exist", async () => {
    const existingDates = Array.from({ length: 10 }, (_, i) => `2026-05-${10 + i}`);

    mockSessionCountEq.mockResolvedValue({ count: 360, data: null, error: null });
    mockExistingDatesIn.mockResolvedValue({
      data: existingDates.map((date) => ({ date })),
      error: null,
    });

    const sessions = existingDates.map((date) => ({
      date,
      totalSeconds: 100,
    }));
    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ sessions }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockExistingDatesIn).toHaveBeenCalledWith("date", existingDates);
    expect(mockRpc).toHaveBeenCalledWith("batch_upsert_sessions", {
      sessions: existingDates.map((date) => ({
        user_id: "test-user-id",
        date,
        total_seconds: 100,
        file_count: 0,
        project_count: 0,
      })),
    });
  });

  it("successfully syncs sessions via batch_upsert_sessions RPC", async () => {
    const sessions = [
      { date: "2026-05-27", totalSeconds: 3600, fileCount: 12, projectCount: 3 },
    ];
    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ sessions }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      synced: 1,
      message: "Sessions synced successfully",
    });

    expect(mockRpc).toHaveBeenCalledWith("batch_upsert_sessions", {
      sessions: [
        {
          user_id: "test-user-id",
          date: "2026-05-27",
          total_seconds: 3600,
          file_count: 12,
          project_count: 3,
        },
      ],
    });
  });

  it("authenticates only against api_key_hash -- no fallback to api_key column", async () => {
    const sessions = [{ date: "2026-05-27", totalSeconds: 3600, fileCount: 2, projectCount: 1 }];
    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ sessions }),
    });

    const res = await POST(req);
    const keyHash = createHash("sha256").update("test-key").digest("hex");

    expect(res.status).toBe(200);
    expect(mockKeyLookupEq).toHaveBeenCalledWith("api_key_hash", keyHash);
    expect(mockUpdateEq).toHaveBeenCalledWith("api_key_hash", keyHash);
  });

  it("returns 500 error if batch_upsert_sessions RPC fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "DB Error" } });

    const sessions = [{ date: "2026-05-27", totalSeconds: 120 }];
    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ sessions }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to sync sessions" });
  });

  it("authenticates via legacy fallback and triggers silent upgrade", async () => {
    let callCount = 0;
    mockSingle.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { data: null, error: { message: "Not found" } };
      } else {
        return { data: { id: "legacy-key-id", user_id: "legacy-user-id" }, error: null };
      }
    });

    const mockUpdateFields = vi.fn();
    const mockUpdateEqLocal = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "local_coding_api_keys") {
        return {
          select: vi.fn().mockReturnValue({
            eq: mockKeyLookupEq,
          }),
          update: vi.fn((fields) => {
            mockUpdateFields(fields);
            return {
              eq: mockUpdateEqLocal,
            };
          }),
        };
      }
      if (table === "local_coding_sessions") {
        return {
          select: vi.fn((_columns: string, options?: { count?: string; head?: boolean }) => {
            if (options?.count) {
              return { eq: mockSessionCountEq };
            }
            return { eq: mockExistingDatesEq };
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const sessions = [{ date: "2026-05-27", totalSeconds: 3600 }];
    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer legacy-raw-key",
      },
      body: JSON.stringify({ sessions }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const keyHash = createHash("sha256").update("legacy-raw-key").digest("hex");

    expect(mockKeyLookupEq).toHaveBeenCalledWith("api_key_hash", keyHash);
    expect(mockKeyLookupEq).toHaveBeenCalledWith("api_key", "legacy-raw-key");

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockUpdateFields).toHaveBeenCalledWith({
      api_key_hash: keyHash,
      api_key: null,
      last_used_at: expect.any(String),
    });
    expect(mockUpdateEqLocal).toHaveBeenCalledWith("id", "legacy-key-id");
  });

  it("rejects request if both standard match and legacy fallback fail", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "Not found" } });

    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer invalid-key",
      },
      body: JSON.stringify({ sessions: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid API key" });
  });
});

