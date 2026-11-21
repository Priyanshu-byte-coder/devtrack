import { beforeEach, describe, expect, it, vi } from "vitest";

const getRankRow = vi.fn();
const getRegistration = vi.fn();

vi.mock("@/lib/gamification/live-rank", () => ({
  getRankRow: (...args: unknown[]) => getRankRow(...args),
}));
vi.mock("@/lib/guest-profile", () => ({
  getRegistration: (...args: unknown[]) => getRegistration(...args),
}));

import Image from "@/app/u/[username]/opengraph-image";

const params = (username: string) => ({
  params: Promise.resolve({ username }),
});

describe("profile share card", () => {
  beforeEach(() => {
    getRankRow.mockReset();
    getRegistration.mockReset();
  });

  it("sends people who aren't on DevTrack to the static card", async () => {
    getRankRow.mockResolvedValue(null);
    getRegistration.mockResolvedValue(null);

    const res = await Image(params("gvanrossum"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/og\/devtrack-card\.png$/);
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400");
  });

  it("still draws a card for members", async () => {
    getRankRow.mockResolvedValue(null);
    getRegistration.mockResolvedValue({ isPublic: true });

    const res = await Image(params("octocat"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
  });
});
