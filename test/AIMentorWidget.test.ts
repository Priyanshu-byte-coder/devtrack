// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AIMentorWidget } from "@/components/AIMentorWidget";
import React from "react";

const mockAIData = {
  data: {
    insights: [
      {
        id: "insight-1",
        type: "consistency",
        title: "High Consistency",
        description: "You coded 5 days in a row!",
        severity: "positive",
      },
    ],
    trend: { direction: "up", percentage: 25 },
    aiSummary: "<h3>Weekly Focus</h3><p>Keep up the <strong>great work</strong> in <code>devtrack</code>!</p>",
    generatedAt: "2026-06-01T07:00:00.000Z",
  },
};

describe("AIMentorWidget Component", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockAIData),
        } as Response)
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders loader initially and then renders insights and trend data", async () => {
    render(React.createElement(AIMentorWidget));

    // Loader status should exist initially
    expect(screen.getByRole("status")).toBeInTheDocument();

    await waitFor(() => {
      // Heading AI Mentor
      expect(screen.getByText("AI Mentor")).toBeInTheDocument();
      // Trend text
      expect(screen.getByText(/↑/i)).toBeInTheDocument();
      expect(screen.getByText(/25%/i)).toBeInTheDocument();
      // Insight card
      expect(screen.getByText("High Consistency")).toBeInTheDocument();
      expect(screen.getByText("You coded 5 days in a row!")).toBeInTheDocument();
    });
  });

  it("renders safe HTML formatting post-sanitization", async () => {
    render(React.createElement(AIMentorWidget));

    await waitFor(() => {
      // 1. Check for header element <h3>
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toBeInTheDocument();
      expect(heading.textContent).toBe("Weekly Focus");

      // 2. Check for strong element
      const strongElement = screen.getByText("great work");
      expect(strongElement.tagName).toBe("STRONG");

      // 3. Check for code element
      const codeElement = screen.getByText("devtrack");
      expect(codeElement.tagName).toBe("CODE");
    });
  });

  it("sanitizes and strips malicious script tags and event handlers from HTML", async () => {
    const maliciousData = {
      data: {
        ...mockAIData.data,
        aiSummary: `<h3>Safe Advice</h3><script>alert('malicious script')</script><img src="x" onerror="alert('onerror attack')" /><strong onclick="alert('click attack')">Safe text inside strong</strong>`,
      },
    };

    vi.mocked(global.fetch).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(maliciousData),
      } as Response)
    );

    render(React.createElement(AIMentorWidget));

    await waitFor(() => {
      // The safe elements should still be rendered correctly
      expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Safe Advice");
      expect(screen.getByText("Safe text inside strong")).toBeInTheDocument();

      // The script tag should be stripped from the DOM
      const aiSummaryContainer = screen.getByText("Safe Advice").parentElement;
      expect(aiSummaryContainer?.innerHTML).not.toContain("<script>");
      
      // The onerror and onclick attribute should be stripped
      const img = aiSummaryContainer?.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img?.getAttribute("onerror")).toBeNull();

      const strong = aiSummaryContainer?.querySelector("strong");
      expect(strong).toBeInTheDocument();
      expect(strong?.getAttribute("onclick")).toBeNull();
    });
  });

  it("toggles collapse and expand states correctly when clicking toggle button", async () => {
    render(React.createElement(AIMentorWidget));

    await waitFor(() => {
      expect(screen.getByText("High Consistency")).toBeInTheDocument();
    });

    const toggleBtn = screen.getByLabelText("Collapse AI Mentor");
    expect(toggleBtn).toBeInTheDocument();

    // Click collapse
    fireEvent.click(toggleBtn);

    // After collapse, the summary and insights should be hidden from view
    await waitFor(() => {
      expect(screen.queryByText("High Consistency")).not.toBeInTheDocument();
      expect(screen.queryByText("Weekly Focus")).not.toBeInTheDocument();
    });

    // Button label should switch to Expand
    const expandBtn = screen.getByLabelText("Expand AI Mentor");
    expect(expandBtn).toBeInTheDocument();

    // Click expand
    fireEvent.click(expandBtn);

    // Insights should reappear
    await waitFor(() => {
      expect(screen.getByText("High Consistency")).toBeInTheDocument();
      expect(screen.getByText("Weekly Focus")).toBeInTheDocument();
    });
  });

  it("renders fallback error message when API call fails", async () => {
    vi.mocked(global.fetch).mockImplementationOnce(() =>
      Promise.reject(new Error("Network Error"))
    );

    render(React.createElement(AIMentorWidget));

    await waitFor(() => {
      expect(
        screen.getByText("AI insights are unavailable right now. Please try again later.")
      ).toBeInTheDocument();
    });
  });
});
