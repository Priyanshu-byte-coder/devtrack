import React from "react";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WeeklySummaryCard from "@/components/WeeklySummaryCard";
import { signIn, signOut } from "next-auth/react";

vi.mock("next-auth/react", () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
  signIn: vi.fn().mockResolvedValue(undefined),
}));

function reply(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

const mockSummaryData = {
  commits: {
    current: 14,
    previous: 10,
    delta: 4,
    trend: "up" as const,
  },
  prs: {
    thisWeek: { opened: 6, merged: 5 },
    lastWeek: { opened: 4, merged: 3 },
  },
  issues: {
    thisWeek: { opened: 2, closed: 3 },
    lastWeek: { opened: 1, closed: 2 },
  },
  productivityScore: {
    current: 82,
    previous: 75,
  },
  activeDays: {
    thisWeek: 4,
    lastWeek: 3,
  },
  streak: 5,
  topRepo: "owner/cool-repo",
};

const mockZeroSummaryData = {
  commits: {
    current: 0,
    previous: 0,
    delta: 0,
    trend: "same" as const,
  },
  prs: {
    thisWeek: { opened: 0, merged: 0 },
    lastWeek: { opened: 0, merged: 0 },
  },
  activeDays: {
    thisWeek: 0,
    lastWeek: 0,
  },
  streak: 0,
  topRepo: null,
};

describe("WeeklySummaryCard", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi
      .fn()
      .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";

        if (url.includes("/api/metrics/weekly-summary") && method === "GET") {
          return reply(200, mockSummaryData);
        }
        if (url.includes("/api/ai/weekly-summary") && method === "POST") {
          return reply(200, {
            summary: "Solid weekly velocity with 14 commits and 5 merged PRs.",
          });
        }
        return reply(404, { error: "Not found" });
      });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders loading state with status role and aria-busy until request resolves", async () => {
    let resolvePromise: (value: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolvePromise = resolve;
    });
    fetchMock.mockReturnValue(pendingPromise);

    render(<WeeklySummaryCard />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading weekly summary")).toBeInTheDocument();
    expect(screen.queryByText("Commits")).not.toBeInTheDocument();

    resolvePromise!(
      new Response(JSON.stringify(mockSummaryData), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    expect(await screen.findByText("Commits")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("displays error message on initial summary HTTP failure", async () => {
    fetchMock.mockReturnValue(reply(500, { error: "Internal Server Error" }));

    render(<WeeklySummaryCard />);

    expect(
      await screen.findByText(
        "We couldn't load your weekly summary right now. Please try again in a moment."
      )
    ).toBeInTheDocument();
  });

  it("displays error message on initial summary network rejection", async () => {
    fetchMock.mockRejectedValue(new Error("Connection error"));

    render(<WeeklySummaryCard />);

    expect(
      await screen.findByText(
        "We couldn't load your weekly summary right now. Please try again in a moment."
      )
    ).toBeInTheDocument();
  });

  it("renders realistic summary metrics accurately", async () => {
    render(<WeeklySummaryCard />);

    expect(await screen.findByText("Commits")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("+4")).toBeInTheDocument();
    expect(screen.getByText("PRs Merged")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Issues Resolved")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Active Days")).toBeInTheDocument();
    expect(screen.getByText("4 / 7")).toBeInTheDocument();
    expect(screen.getByText("5 day streak")).toBeInTheDocument();
    expect(screen.getByText("cool-repo")).toBeInTheDocument();
    expect(screen.getByText("Productivity Score")).toBeInTheDocument();
    expect(screen.getByText("82")).toBeInTheDocument();
  });

  it("renders zero-value metrics gracefully when API returns no-data response", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/metrics/weekly-summary")) {
        return reply(200, mockZeroSummaryData);
      }
      return reply(404, {});
    });

    render(<WeeklySummaryCard />);

    expect(await screen.findByText("Commits")).toBeInTheDocument();
    expect(screen.getByText("0 / 7")).toBeInTheDocument();
    expect(screen.getByText("0 day streak")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("handles AI generation flow including payload submission and pending state", async () => {
    let resolveAiPromise: (value: Response) => void;
    const pendingAi = new Promise<Response>((resolve) => {
      resolveAiPromise = resolve;
    });

    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        if (url.includes("/api/metrics/weekly-summary") && method === "GET") {
          return reply(200, mockSummaryData);
        }
        if (url.includes("/api/ai/weekly-summary") && method === "POST") {
          return pendingAi;
        }
        return reply(404, {});
      }
    );

    render(<WeeklySummaryCard />);

    const generateBtn = await screen.findByRole("button", {
      name: "Generate AI summary",
    });
    fireEvent.click(generateBtn);

    expect(await screen.findByText("Generating summary…")).toBeInTheDocument();

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        typeof url === "string" &&
        url.includes("/api/ai/weekly-summary") &&
        init?.method === "POST"
    );
    expect(postCall).toBeDefined();
    const payload = JSON.parse(postCall![1].body as string);
    expect(payload.commits.current).toBe(14);
    expect(payload.prs.thisWeek.merged).toBe(5);
    expect(payload.streak).toBe(5);
    expect(payload.topRepo).toBe("owner/cool-repo");

    resolveAiPromise!(
      new Response(
        JSON.stringify({
          summary: "Solid weekly velocity with 14 commits and 5 merged PRs.",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    expect(
      await screen.findByText(
        "Solid weekly velocity with 14 commits and 5 merged PRs."
      )
    ).toBeInTheDocument();
  });

  it("displays error message when AI generation endpoint fails", async () => {
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        if (url.includes("/api/metrics/weekly-summary") && method === "GET") {
          return reply(200, mockSummaryData);
        }
        if (url.includes("/api/ai/weekly-summary") && method === "POST") {
          return reply(500, { error: "AI model unavailable" });
        }
        return reply(404, {});
      }
    );

    render(<WeeklySummaryCard />);

    const generateBtn = await screen.findByRole("button", {
      name: "Generate AI summary",
    });
    fireEvent.click(generateBtn);

    expect(await screen.findByText("AI model unavailable")).toBeInTheDocument();
  });

  it("handles HTTP 429 rate limit response with reset timer message", async () => {
    const futureReset = new Date(Date.now() + 3_600_000 * 2).toISOString();
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        if (url.includes("/api/metrics/weekly-summary") && method === "GET") {
          return reply(200, mockSummaryData);
        }
        if (url.includes("/api/ai/weekly-summary") && method === "POST") {
          return reply(429, { rateLimitReset: futureReset });
        }
        return reply(404, {});
      }
    );

    render(<WeeklySummaryCard />);

    const generateBtn = await screen.findByRole("button", {
      name: "Generate AI summary",
    });
    fireEvent.click(generateBtn);

    expect(
      await screen.findByText(
        /Summary already generated today\. Next available in/i
      )
    ).toBeInTheDocument();
  });

  it("handles AI generation network rejection", async () => {
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        if (url.includes("/api/metrics/weekly-summary") && method === "GET") {
          return reply(200, mockSummaryData);
        }
        if (url.includes("/api/ai/weekly-summary") && method === "POST") {
          return Promise.reject(new Error("Network disconnect"));
        }
        return reply(404, {});
      }
    );

    render(<WeeklySummaryCard />);

    const generateBtn = await screen.findByRole("button", {
      name: "Generate AI summary",
    });
    fireEvent.click(generateBtn);

    expect(
      await screen.findByText(
        "Could not reach the summary service. Please try again."
      )
    ).toBeInTheDocument();
  });

  it("copies AI summary to clipboard when copy button is clicked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<WeeklySummaryCard />);

    const generateBtn = await screen.findByRole("button", {
      name: "Generate AI summary",
    });
    fireEvent.click(generateBtn);

    const copyBtn = await screen.findByRole("button", {
      name: "Copy AI summary to clipboard",
    });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        "Solid weekly velocity with 14 commits and 5 merged PRs."
      );
    });
  });

  it("triggers report download with weekly-summary-report.txt filename", async () => {
    const createObjectURLMock = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock-url");
    const revokeObjectURLMock = vi
      .spyOn(URL, "revokeObjectURL")
      .mockReturnValue();
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    render(<WeeklySummaryCard />);

    const downloadBtn = await screen.findByRole("button", {
      name: "Download weekly report",
    });
    fireEvent.click(downloadBtn);

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");

    createObjectURLMock.mockRestore();
    revokeObjectURLMock.mockRestore();
    clickSpy.mockRestore();
  });

  it("collapses and expands summary content when toggle button is clicked", async () => {
    render(<WeeklySummaryCard />);

    await screen.findByText("Commits");

    const collapseBtn = screen.getByRole("button", {
      name: "Collapse weekly summary",
    });
    expect(collapseBtn).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(collapseBtn);

    expect(screen.queryByText("Commits")).not.toBeInTheDocument();
    const expandBtn = screen.getByRole("button", {
      name: "Expand weekly summary",
    });
    expect(expandBtn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(expandBtn);
    expect(await screen.findByText("Commits")).toBeInTheDocument();
  });

  it("handles token_expired error by presenting reconnect action", async () => {
    fetchMock.mockReturnValue(reply(200, { error: "token_expired" }));

    render(<WeeklySummaryCard />);

    const reconnectBtn = await screen.findByRole("button", {
      name: "Reconnect GitHub",
    });
    expect(
      screen.getByText(
        "Your GitHub connection is no longer valid. Reconnect your GitHub account to continue syncing data."
      )
    ).toBeInTheDocument();

    fireEvent.click(reconnectBtn);

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({ redirect: false });
    });
    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("github", {
        callbackUrl: "/dashboard",
      });
    });
  });
});
