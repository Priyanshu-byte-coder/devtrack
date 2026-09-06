import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

describe("GET /api/leaderboard timeframe validation", () => {
  it("returns 400 for an unsupported timeframe", async () => {
    const { GET } = await import("@/app/api/leaderboard/route");
    const response = await GET(new NextRequest("http://localhost/api/leaderboard?timeframe=yearly"));

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toMatch(/Invalid timeframe/i);
  });
});
