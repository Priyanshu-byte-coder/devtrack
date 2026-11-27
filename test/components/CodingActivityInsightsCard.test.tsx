import React from "react";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../messages/en.json";
import CodingActivityInsightsCard from "../../src/components/CodingActivityInsightsCard";
import {
  AccountContext,
  AccountProvider,
} from "../../src/components/AccountContext";
import type { CodingActivityInsight } from "../../src/lib/coding-activity-insights";

function renderWithIntl(ui: React.ReactElement) {
  const result = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  );
  return {
    ...result,
    rerender: (newUi: React.ReactElement) =>
      result.rerender(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          {newUi}
        </NextIntlClientProvider>
      ),
  };
}

function createJsonResponse(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

const realisticInsightFixture: CodingActivityInsight = {
  timezone: "UTC+01:00",
  totalActivities: 50,
  hourlyCounts: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hour === 14 ? 12 : hour === 3 ? 1 : hour % 2 === 0 ? 3 : 1,
  })),
  mostActiveHour: {
    hour: 14,
    count: 12,
    label: "2 PM – 3 PM",
  },
  leastActiveHour: {
    hour: 3,
    count: 1,
    label: "3 AM – 4 AM",
  },
  mostActiveDay: {
    day: "Wednesday",
    count: 15,
  },
  consistencyScore: 85,
  averageDailyCommits: 3.5,
  productivityLevel: "Very Good",
  weeklyTrend: {
    direction: "up",
    percentage: 25,
  },
  summary: [
    "Your most productive day was Wednesday with 15 commits.",
    "Your weekly consistency score is 85%.",
  ],
  recommendations: [
    "Maintain current momentum during afternoon hours.",
    "Consider balancing work across weekdays.",
  ],
};

describe("CodingActivityInsightsCard", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders loading state while request is pending", async () => {
    // Keep request pending
    fetchMock.mockImplementation(() => new Promise(() => {}));

    renderWithIntl(
      <AccountProvider>
        <CodingActivityInsightsCard />
      </AccountProvider>
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading coding activity insights"
    );
    const refreshBtn = screen.getByRole("button", {
      name: "Refresh coding activity insights",
    });
    expect(refreshBtn).toBeDisabled();
    expect(refreshBtn).toHaveTextContent("Refreshing");
  });

  it("renders error state when API call fails and allows retry", async () => {
    let callCount = 0;
    fetchMock.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return createJsonResponse(500, { error: "Internal Server Error" });
      }
      return createJsonResponse(200, realisticInsightFixture);
    });

    renderWithIntl(
      <AccountProvider>
        <CodingActivityInsightsCard />
      </AccountProvider>
    );

    expect(
      await screen.findByText(
        "We couldn't load your AI Productivity Insights right now. Please try again in a moment."
      )
    ).toBeInTheDocument();

    const tryAgainBtn = screen.getByRole("button", { name: "Try again" });
    expect(tryAgainBtn).toBeInTheDocument();

    // Click Try again
    await act(async () => {
      fireEvent.click(tryAgainBtn);
    });

    // Content should successfully load
    expect(
      await screen.findByText("Coding Activity Insights")
    ).toBeInTheDocument();
    expect(screen.getByText("↑ 25% Improving")).toBeInTheDocument();
  });

  it("renders empty state when API returns no activities", async () => {
    const emptyFixture: CodingActivityInsight = {
      timezone: "UTC",
      totalActivities: 0,
      hourlyCounts: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: 0,
      })),
      mostActiveHour: { hour: 0, count: 0, label: "12 AM – 1 AM" },
      leastActiveHour: { hour: 0, count: 0, label: "12 AM – 1 AM" },
    };

    fetchMock.mockImplementation(async () =>
      createJsonResponse(200, emptyFixture)
    );

    renderWithIntl(
      <AccountProvider>
        <CodingActivityInsightsCard />
      </AccountProvider>
    );

    expect(
      await screen.findByText(
        "Not enough coding activity was detected to generate AI-powered productivity insights yet."
      )
    ).toBeInTheDocument();
  });

  it("renders empty state when API returns partial or malformed payload", async () => {
    fetchMock.mockImplementation(async () =>
      createJsonResponse(200, { error: "github_unavailable" })
    );

    renderWithIntl(
      <AccountProvider>
        <CodingActivityInsightsCard />
      </AccountProvider>
    );

    expect(
      await screen.findByText(
        "Not enough coding activity was detected to generate AI-powered productivity insights yet."
      )
    ).toBeInTheDocument();
  });

  it("renders main content, metrics, summary, and recommendations with realistic data", async () => {
    fetchMock.mockImplementation(async () =>
      createJsonResponse(200, realisticInsightFixture)
    );

    renderWithIntl(
      <AccountProvider>
        <CodingActivityInsightsCard />
      </AccountProvider>
    );

    // Title and trend badge
    expect(
      await screen.findByText("Coding Activity Insights")
    ).toBeInTheDocument();
    expect(screen.getByText("↑ 25% Improving")).toBeInTheDocument();

    // Subtitle contains window and timezone
    expect(
      screen.getByText(/Last 90 days · Commits by hour · UTC\+01:00/)
    ).toBeInTheDocument();

    // Insight rows
    expect(screen.getByText("Most active")).toBeInTheDocument();
    expect(screen.getByText("2 PM – 3 PM with 12 commits")).toBeInTheDocument();

    expect(screen.getByText("Least active")).toBeInTheDocument();
    expect(screen.getByText("3 AM – 4 AM with 1 commit")).toBeInTheDocument();

    expect(screen.getByText("Consistency")).toBeInTheDocument();
    expect(screen.getByText("85% weekly consistency")).toBeInTheDocument();

    expect(screen.getByText("Productivity")).toBeInTheDocument();
    expect(screen.getByText("🔵 Very Good")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Productivity level: Very Good")
    ).toBeInTheDocument();

    expect(screen.getByText("Daily Average")).toBeInTheDocument();
    expect(screen.getByText("3.5 commits/day")).toBeInTheDocument();

    expect(screen.getByText("Best day")).toBeInTheDocument();
    expect(screen.getByText("Wednesday with 15 commits")).toBeInTheDocument();

    // Summary section
    expect(
      screen.getByRole("heading", { name: "AI Productivity Summary" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your most productive day was Wednesday with 15 commits."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your weekly consistency score is 85%.")
    ).toBeInTheDocument();

    // Recommendations section
    expect(
      screen.getByRole("heading", { name: "Smart Recommendations" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("• Maintain current momentum during afternoon hours.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("• Consider balancing work across weekdays.")
    ).toBeInTheDocument();
  });

  it("renders different trend directions (declining and stable)", async () => {
    const decliningFixture: CodingActivityInsight = {
      ...realisticInsightFixture,
      weeklyTrend: { direction: "down", percentage: 15 },
    };

    fetchMock.mockImplementation(async () =>
      createJsonResponse(200, decliningFixture)
    );

    const { rerender } = renderWithIntl(
      <AccountProvider>
        <CodingActivityInsightsCard />
      </AccountProvider>
    );

    expect(await screen.findByText("↓ 15% Declining")).toBeInTheDocument();

    const stableFixture: CodingActivityInsight = {
      ...realisticInsightFixture,
      weeklyTrend: { direction: "stable", percentage: 0 },
    };
    fetchMock.mockImplementation(async () =>
      createJsonResponse(200, stableFixture)
    );

    rerender(
      <AccountProvider>
        <CodingActivityInsightsCard />
      </AccountProvider>
    );

    const refreshBtn = screen.getByRole("button", {
      name: "Refresh coding activity insights",
    });
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    expect(await screen.findByText("Stable Activity")).toBeInTheDocument();
  });

  it("triggers refetch when refresh button is clicked", async () => {
    let callCount = 0;
    fetchMock.mockImplementation(async () => {
      callCount++;
      return createJsonResponse(200, {
        ...realisticInsightFixture,
        totalActivities: callCount * 50,
      });
    });

    renderWithIntl(
      <AccountProvider>
        <CodingActivityInsightsCard />
      </AccountProvider>
    );

    expect(
      await screen.findByText("Coding Activity Insights")
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const refreshBtn = screen.getByRole("button", {
      name: "Refresh coding activity insights",
    });
    expect(refreshBtn).toHaveTextContent("Refresh");

    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("passes timeZone parameter in the fetch request URL", async () => {
    fetchMock.mockImplementation(async () =>
      createJsonResponse(200, realisticInsightFixture)
    );

    renderWithIntl(
      <AccountProvider>
        <CodingActivityInsightsCard />
      </AccountProvider>
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const callUrl = fetchMock.mock.calls[0][0] as string;
    expect(callUrl).toContain("/api/metrics/coding-activity-insights?");
    expect(callUrl).toContain("timeZone=");
  });

  it("includes accountId in query parameters when selectedAccount is provided", async () => {
    fetchMock.mockImplementation(async () =>
      createJsonResponse(200, realisticInsightFixture)
    );

    renderWithIntl(
      <AccountContext.Provider
        value={{
          selectedAccount: "github-acc-999",
          setSelectedAccount: vi.fn(),
        }}
      >
        <CodingActivityInsightsCard />
      </AccountContext.Provider>
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const callUrl = fetchMock.mock.calls[0][0] as string;
    expect(callUrl).toContain("accountId=github-acc-999");
  });
});
