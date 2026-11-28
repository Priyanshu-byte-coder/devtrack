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
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ProductiveHoursWidget from "@/components/ProductiveHoursWidget";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>
  );
}

function reply(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

const mockSuccessData = {
  grid: [
    { day: 1, hour: 9, count: 10, avg: 2.0 },
    { day: 1, hour: 14, count: 25, avg: 5.0 },
    { day: 3, hour: 11, count: 15, avg: 3.0 },
    { day: 5, hour: 16, count: 8, avg: 1.6 },
  ],
  peak: { day: 1, hour: 14, count: 25, avg: 5.0 },
  total: 58,
  days: 90,
  timezone: "UTC",
};

const mockZeroData = {
  grid: [],
  peak: null,
  total: 0,
  days: 90,
  timezone: "UTC",
};

describe("ProductiveHoursWidget", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
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
    localStorage.clear();
  });

  it("renders heading and loading state until request resolves", async () => {
    let resolvePromise: (value: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolvePromise = resolve;
    });
    fetchMock.mockReturnValue(pendingPromise);

    renderWithIntl(<ProductiveHoursWidget />);

    expect(
      screen.getByRole("heading", { name: "Most Productive Hours" })
    ).toBeInTheDocument();

    // Chart data content is not yet visible while loading
    expect(screen.queryByText(/commits analysed/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/api/metrics/productive-hours"
    );

    // Resolve request with success data
    resolvePromise!(
      new Response(JSON.stringify(mockSuccessData), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    expect(await screen.findByText("58 commits analysed.")).toBeInTheDocument();
  });

  it("displays error message on HTTP failure", async () => {
    fetchMock.mockReturnValue(reply(500, { error: "Server Error" }));

    renderWithIntl(<ProductiveHoursWidget />);

    expect(
      await screen.findByText(
        "Failed to load productive hours data. Please try refreshing."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/commits analysed/i)).not.toBeInTheDocument();
  });

  it("displays error message on network rejection", async () => {
    fetchMock.mockRejectedValue(new Error("Network connection lost"));

    renderWithIntl(<ProductiveHoursWidget />);

    expect(
      await screen.findByText(
        "Failed to load productive hours data. Please try refreshing."
      )
    ).toBeInTheDocument();
  });

  it("handles empty API data by displaying zero-commit grid and count", async () => {
    fetchMock.mockReturnValue(reply(200, mockZeroData));

    renderWithIntl(<ProductiveHoursWidget />);

    expect(await screen.findByText("0 commits analysed.")).toBeInTheDocument();
    expect(screen.queryByText(/Peak:/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Monday 9am — avg 0.0 commits" })
    ).toBeInTheDocument();
  });

  it("renders realistic data with peak information and accessible cell names", async () => {
    fetchMock.mockReturnValue(reply(200, mockSuccessData));

    renderWithIntl(<ProductiveHoursWidget />);

    expect(await screen.findByText("58 commits analysed.")).toBeInTheDocument();
    expect(
      screen.getByText(/Peak: Monday 2pm — avg 5.0 commits/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Updated just now")).toBeInTheDocument();

    // Verify cell buttons by accessible tooltip names
    expect(
      screen.getByRole("button", { name: "Monday 9am — avg 2.0 commits" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Monday 2pm — avg 5.0 commits" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Wednesday 11am — avg 3.0 commits" })
    ).toBeInTheDocument();
  });

  it("allows switching preset ranges and persists selection to localStorage", async () => {
    fetchMock.mockReturnValue(reply(200, mockSuccessData));

    renderWithIntl(<ProductiveHoursWidget />);

    await screen.findByText("58 commits analysed.");

    const btn30 = screen.getByRole("button", { name: "Show 30-day range" });
    const btn180 = screen.getByRole("button", { name: "Show 180-day range" });

    fireEvent.click(btn30);
    await waitFor(() => {
      expect(btn30).toHaveAttribute("aria-pressed", "true");
    });
    expect(localStorage.getItem("devtrack:productive-hours-range")).toBe("30");

    fireEvent.click(btn180);
    await waitFor(() => {
      expect(btn180).toHaveAttribute("aria-pressed", "true");
    });
    expect(localStorage.getItem("devtrack:productive-hours-range")).toBe("180");
  });

  it("supports custom date range selection and input validation", async () => {
    fetchMock.mockReturnValue(reply(200, mockSuccessData));

    renderWithIntl(<ProductiveHoursWidget />);

    await screen.findByText("58 commits analysed.");

    const customButton = screen.getByRole("button", { name: "Custom…" });
    fireEvent.click(customButton);

    expect(screen.getByText("Custom range")).toBeInTheDocument();

    const startInput = screen.getByLabelText("Start date");
    const endInput = screen.getByLabelText("End date");
    const applyButton = screen.getByRole("button", { name: "Apply" });

    // Test invalid case: start date > end date
    fireEvent.change(startInput, { target: { value: "2026-05-20" } });
    fireEvent.change(endInput, { target: { value: "2026-05-10" } });
    fireEvent.click(applyButton);

    expect(
      screen.getByText("Start date must be before end date.")
    ).toBeInTheDocument();

    // Test valid custom range
    fireEvent.change(startInput, { target: { value: "2026-01-01" } });
    fireEvent.change(endInput, { target: { value: "2026-01-31" } });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.queryByText("Custom range")).not.toBeInTheDocument();
    });

    // Check request was made with custom dates
    const lastCallUrl = fetchMock.mock.calls[
      fetchMock.mock.calls.length - 1
    ][0] as string;
    expect(lastCallUrl).toContain("from=2026-01-01");
    expect(lastCallUrl).toContain("to=2026-01-31");
  });

  it("allows switching heatmap themes without errors", async () => {
    fetchMock.mockReturnValue(reply(200, mockSuccessData));

    renderWithIntl(<ProductiveHoursWidget />);

    await screen.findByText("58 commits analysed.");

    const defaultBtn = screen.getByRole("button", { name: "Default" });
    const colourBlindBtn = screen.getByRole("button", { name: "Colour-blind" });
    const themeBtn = screen.getByRole("button", { name: "Theme" });

    fireEvent.click(colourBlindBtn);
    expect(colourBlindBtn).toBeInTheDocument();

    fireEvent.click(themeBtn);
    expect(themeBtn).toBeInTheDocument();

    fireEvent.click(defaultBtn);
    expect(defaultBtn).toBeInTheDocument();
  });
});
