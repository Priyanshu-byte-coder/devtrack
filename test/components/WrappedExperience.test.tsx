import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WrappedExperience from "../../src/components/WrappedExperience";
import type { WrappedStats } from "../../src/lib/wrapped";

function reply(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

const mockStats: WrappedStats = {
  username: "octocat",
  year: 2026,
  totalCommits: 1420,
  longestStreak: 42,
  prsMerged: 88,
  activeDays: 215,
  mostProductiveMonth: {
    name: "November",
    commits: 230,
  },
  mostContributedRepo: {
    name: "devtrack/core",
    commits: 650,
  },
  topLanguages: [
    { name: "TypeScript", bytes: 65000, percentage: 65 },
    { name: "Rust", bytes: 25000, percentage: 25 },
    { name: "Python", bytes: 10000, percentage: 10 },
  ],
  peakCodingHour: {
    hour: 14,
    label: "2 PM",
    commits: 340,
  },
  personality: {
    id: "crusader",
    name: "Code Crusader",
    icon: "⚔️",
    description: "Always ready to conquer new codebases.",
    reason: "High velocity across multiple repos.",
  },
  generatedAt: "2026-11-26T00:00:00Z",
  partial: false,
};

describe("WrappedExperience Component", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/wrapped");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("displays the loader while request is pending and clears it upon completion", async () => {
      fetchMock.mockReturnValue(reply(200, mockStats));

      render(<WrappedExperience />);

      expect(screen.getByRole("status")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      expect(screen.getByText("1,420 commits")).toBeInTheDocument();
    });

    it("transitions from loading to error when the request fails", async () => {
      fetchMock.mockRejectedValue(new Error("Network failed"));

      render(<WrappedExperience />);

      expect(screen.getByRole("status")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      });

      expect(
        screen.getByText("Wrapped is taking a breather")
      ).toBeInTheDocument();
      expect(
        screen.getByText("We could not build your Year in Code right now.")
      ).toBeInTheDocument();
    });
  });

  describe("Error State and Recovery", () => {
    it("renders error state when HTTP response is not ok", async () => {
      fetchMock.mockReturnValue(reply(500, { error: "Internal Server Error" }));

      render(<WrappedExperience />);

      await waitFor(() => {
        expect(
          screen.getByText("Wrapped is taking a breather")
        ).toBeInTheDocument();
      });

      expect(
        screen.getByRole("button", { name: /continue/i })
      ).toBeInTheDocument();
    });

    it("retries fetching when the continue button is clicked", async () => {
      fetchMock.mockReturnValueOnce(reply(500, { error: "Server down" }));

      render(<WrappedExperience />);

      await waitFor(() => {
        expect(
          screen.getByText("Wrapped is taking a breather")
        ).toBeInTheDocument();
      });

      fetchMock.mockReturnValueOnce(reply(200, mockStats));

      const continueBtn = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(continueBtn);

      await waitFor(() => {
        expect(screen.getByText("1,420 commits")).toBeInTheDocument();
      });
    });

    it("shows error state when API returns malformed payload missing topLanguages", async () => {
      fetchMock.mockReturnValue(reply(200, { invalid: "payload" }));

      render(<WrappedExperience />);

      await waitFor(() => {
        expect(
          screen.getByText("Wrapped is taking a breather")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Empty / Edge Data States", () => {
    it("handles empty top languages and sparse peak hour correctly", async () => {
      const sparseStats: WrappedStats = {
        ...mockStats,
        topLanguages: [],
        peakCodingHour: {
          hour: null,
          label: "Unknown",
          commits: 0,
        },
      };

      fetchMock.mockReturnValue(reply(200, sparseStats));

      render(<WrappedExperience />);

      await waitFor(() => {
        expect(screen.getByText("1,420 commits")).toBeInTheDocument();
      });

      // Navigate to languages slide (slide index 3)
      const languageSlideBtn = screen.getByRole("button", {
        name: "Go to slide 4: Top 3 languages",
      });
      fireEvent.click(languageSlideBtn);

      expect(screen.getByText("No clear leader")).toBeInTheDocument();
      expect(screen.getByText("No language data yet")).toBeInTheDocument();

      // Navigate to coding clock slide (slide index 6)
      const clockSlideBtn = screen.getByRole("button", {
        name: "Go to slide 7: Peak coding time",
      });
      fireEvent.click(clockSlideBtn);

      expect(
        screen.getByText(
          "Commit timestamps were too sparse for a peak-hour insight."
        )
      ).toBeInTheDocument();
    });

    it("displays partial year banner when year is in progress", async () => {
      const partialStats: WrappedStats = {
        ...mockStats,
        partial: true,
      };

      fetchMock.mockReturnValue(reply(200, partialStats));

      render(<WrappedExperience />);

      await waitFor(() => {
        expect(screen.getByText(/is still in progress/i)).toBeInTheDocument();
      });
    });
  });

  describe("Main Content Rendering and Navigation", () => {
    it("renders header, initial slide, share card preview, and mini stats", async () => {
      fetchMock.mockReturnValue(reply(200, mockStats));

      render(<WrappedExperience />);

      await waitFor(() => {
        expect(screen.getByText("1,420 commits")).toBeInTheDocument();
      });

      // Header
      expect(
        screen.getByRole("heading", { name: "Year in Code" })
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Select year")).toBeInTheDocument();

      // Slide 1
      expect(screen.getByText("Level 01 · 2026 recap")).toBeInTheDocument();
      expect(
        screen.getByText("215 active coding days captured by DevTrack.")
      ).toBeInTheDocument();
      expect(screen.getByText("Slide 1 of 8")).toBeInTheDocument();

      // Mini stats
      expect(screen.getByText("Commits")).toBeInTheDocument();
      expect(screen.getByText("Active days")).toBeInTheDocument();
      expect(screen.getByText("Merged PRs")).toBeInTheDocument();
      expect(screen.getByText("Peak hour")).toBeInTheDocument();

      // Share links
      expect(screen.getByRole("link", { name: "Share on X" })).toHaveAttribute(
        "target",
        "_blank"
      );
      expect(screen.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
        "target",
        "_blank"
      );
    });

    it("navigates forward and backward using Next and Previous buttons", async () => {
      fetchMock.mockReturnValue(reply(200, mockStats));

      render(<WrappedExperience />);

      await waitFor(() => {
        expect(screen.getByText("1,420 commits")).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();

      // Advance to Slide 2 (Streak)
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      expect(screen.getByText("42 day streak")).toBeInTheDocument();
      expect(screen.getByText("Level 02 · Consistency")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /previous/i })
      ).not.toBeDisabled();

      // Go back to Slide 1
      fireEvent.click(screen.getByRole("button", { name: /previous/i }));
      expect(screen.getByText("1,420 commits")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    });

    it("navigates directly through the pagination slide buttons", async () => {
      fetchMock.mockReturnValue(reply(200, mockStats));

      render(<WrappedExperience />);

      await waitFor(() => {
        expect(screen.getByText("1,420 commits")).toBeInTheDocument();
      });

      // Jump to personality slide (Slide 8)
      const personaBtn = screen.getByRole("button", {
        name: "Go to slide 8: Coding Personality",
      });
      fireEvent.click(personaBtn);

      expect(screen.getByText("⚔️ Code Crusader")).toBeInTheDocument();
      expect(
        screen.getByText(/Always ready to conquer new codebases/i)
      ).toBeInTheDocument();

      const nextBtn = screen.getByRole("button", { name: /next/i });
      expect(nextBtn).toBeDisabled();
      expect(screen.getByText("★ Stage clear")).toBeInTheDocument();
    });

    it("handles keyboard navigation (ArrowRight, ArrowLeft, End, Home)", async () => {
      fetchMock.mockReturnValue(reply(200, mockStats));

      render(<WrappedExperience />);

      await waitFor(() => {
        expect(screen.getByText("1,420 commits")).toBeInTheDocument();
      });

      // ArrowRight -> Slide 2
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(screen.getByText("42 day streak")).toBeInTheDocument();

      // End -> Last slide (Slide 8)
      fireEvent.keyDown(window, { key: "End" });
      expect(screen.getByText("⚔️ Code Crusader")).toBeInTheDocument();

      // ArrowLeft -> Slide 7
      fireEvent.keyDown(window, { key: "ArrowLeft" });
      expect(screen.getByText("Peak coding time")).toBeInTheDocument();

      // Home -> Slide 1
      fireEvent.keyDown(window, { key: "Home" });
      expect(screen.getByText("1,420 commits")).toBeInTheDocument();
    });

    it("updates selected year when dropdown selection changes", async () => {
      fetchMock.mockReturnValue(reply(200, mockStats));

      render(<WrappedExperience />);

      await waitFor(() => {
        expect(screen.getByText("1,420 commits")).toBeInTheDocument();
      });

      const yearSelect = screen.getByLabelText("Select year");
      fireEvent.change(yearSelect, { target: { value: "2024" } });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("year=2024"),
          expect.anything()
        );
      });
    });

    it("reads initial year from query parameter if present", async () => {
      window.history.replaceState({}, "", "/wrapped?year=2023");
      fetchMock.mockReturnValue(reply(200, mockStats));

      render(<WrappedExperience />);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("year=2023"),
          expect.anything()
        );
      });
    });
  });
});
