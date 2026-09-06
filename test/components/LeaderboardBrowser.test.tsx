import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LeaderboardBrowser from "@/components/leaderboard/LeaderboardBrowser";
import type { LeaderboardPayload } from "@/lib/leaderboard";

vi.mock("next/image", () => ({
  default: ({ unoptimized, ...props }: any) => <img {...props} />,
}));

function createLeaderboardPayload(username: string, commits: number, prs: number): LeaderboardPayload {
  return {
    generatedAt: "2026-07-03T12:00:00.000Z",
    refreshSeconds: 3600,
    leaders: {
      streak: [
        {
          id: `${username}-id`,
          rank: 1,
          username,
          avatarUrl: `https://github.com/${username}.png?size=96`,
          profileUrl: `/u/${username}`,
          streak: 2,
          commits,
          prs,
          score: 10,
          isSponsor: false,
        },
      ],
      commits: [
        {
          id: `${username}-id`,
          rank: 1,
          username,
          avatarUrl: `https://github.com/${username}.png?size=96`,
          profileUrl: `/u/${username}`,
          streak: 2,
          commits,
          prs,
          score: 10,
          isSponsor: false,
        },
      ],
      prs: [
        {
          id: `${username}-id`,
          rank: 1,
          username,
          avatarUrl: `https://github.com/${username}.png?size=96`,
          profileUrl: `/u/${username}`,
          streak: 2,
          commits,
          prs,
          score: 10,
          isSponsor: false,
        },
      ],
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("LeaderboardBrowser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("switches timeframes with API fetches and shows a loading skeleton while waiting", async () => {
    const weekly = createLeaderboardPayload("alice", 8, 1);
    const monthly = createLeaderboardPayload("bob", 18, 3);
    const allTime = createLeaderboardPayload("carol", 25, 4);

    const monthlyRequest = createDeferred<Response>();
    const allTimeRequest = createDeferred<Response>();
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("timeframe=monthly")) {
        return monthlyRequest.promise;
      }
      if (url.includes("timeframe=all_time")) {
        return allTimeRequest.promise;
      }
      return Promise.resolve({
        ok: true,
        json: async () => weekly,
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <LeaderboardBrowser
        activeTab="commits"
        language="typescript"
        initialTimeframe="weekly"
        initialLeaderboard={weekly}
      />
    );

    expect(screen.getByText("@alice")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Monthly" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/leaderboard?timeframe=monthly&lang=typescript",
        expect.objectContaining({ headers: { Accept: "application/json" } })
      );
    });

    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);

    monthlyRequest.resolve({
      ok: true,
      json: async () => monthly,
    } as Response);

    await waitFor(() => {
      expect(screen.getByText("@bob")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("tab", { name: "All-Time" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/leaderboard?timeframe=all_time&lang=typescript",
        expect.objectContaining({ headers: { Accept: "application/json" } })
      );
    });

    allTimeRequest.resolve({
      ok: true,
      json: async () => allTime,
    } as Response);

    await waitFor(() => {
      expect(screen.getByText("@carol")).toBeTruthy();
    });
  });
});
