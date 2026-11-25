import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import ProfileStatCards, { formatNumber, formatMemberSince } from "@/components/ProfileStatCards";

describe("ProfileStatCards Component (Issue #84)", () => {
  it("formats numbers properly (1.2k, 1.5M, raw numbers)", () => {
    expect(formatNumber(500)).toBe("500");
    expect(formatNumber(1200)).toBe("1.2k");
    expect(formatNumber(10000)).toBe("10k");
    expect(formatNumber(1500000)).toBe("1.5M");
  });

  it("formats memberSince ISO date cleanly", () => {
    expect(formatMemberSince("2021-04-12T10:00:00Z")).toContain("2021");
    expect(formatMemberSince("invalid")).toBe("—");
  });

  it("renders stat cards when stats are provided", () => {
    const mockStats = {
      memberSince: "2020-01-15T00:00:00Z",
      publicRepos: 42,
      totalStars: 1250,
      totalForks: 88,
      followers: 240,
    };

    const { getByText } = render(<ProfileStatCards initialStats={mockStats} />);
    expect(getByText("Member Since")).toBeTruthy();
    expect(getByText("Public Repos")).toBeTruthy();
    expect(getByText("42")).toBeTruthy();
    expect(getByText("1.3k")).toBeTruthy();
    expect(getByText("88")).toBeTruthy();
    expect(getByText("240")).toBeTruthy();
  });

  it("renders loading skeleton while loading", () => {
    const { getAllByTestId } = render(<ProfileStatCards />);
    const skeletons = getAllByTestId("stat-skeleton");
    expect(skeletons.length).toBe(5);
  });
});
