import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TodayFocusHero from "../../src/components/TodayFocusHero";

function reply(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function todayStorageKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `devtrack_today_goal_${now.getFullYear()}-${month}-${day}`;
}

describe("TodayFocusHero", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    consoleError.mockRestore();
    vi.unstubAllGlobals();
  });

  it("shows an accessible prompt and placeholder in the empty form", async () => {
    fetchMock.mockReturnValue(reply(200, { goal: null }));
    render(<TodayFocusHero />);

    const input = await screen.findByRole("textbox");
    expect(input).toHaveAttribute("placeholder", "e.g. Fix the login bug…");
    expect(input).toHaveAccessibleName();
    const label = document.querySelector('label[for="today-focus-input"]');
    expect(label).toBeVisible();
    expect(label?.textContent).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("keeps the form usable while the daily-focus request is pending", async () => {
    const request = deferred<Response>();
    fetchMock.mockReturnValue(request.promise);
    render(<TodayFocusHero />);

    expect(await screen.findByRole("textbox")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/daily-focus\?date=\d{4}-\d{2}-\d{2}$/)
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    request.resolve(await reply(200, {}));
  });

  it("remains usable and logs an error when the API request fails", async () => {
    fetchMock.mockRejectedValue(new Error("Network unavailable"));
    render(<TodayFocusHero />);

    expect(await screen.findByRole("textbox")).toBeInTheDocument();
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to fetch daily focus",
        expect.any(Error)
      );
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("shows the empty state when the API returns no goal", async () => {
    fetchMock.mockReturnValue(reply(200, {}));
    render(<TodayFocusHero />);

    expect(await screen.findByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("renders a saved goal returned by the API and caches it locally", async () => {
    fetchMock.mockReturnValue(
      reply(200, { goal: "Finish the accessibility tests" })
    );
    render(<TodayFocusHero />);

    expect(
      await screen.findByText("Finish the accessibility tests")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(window.localStorage.getItem(todayStorageKey())).toBe(
      "Finish the accessibility tests"
    );
  });

  it("saves a new goal and sends it to the API", async () => {
    fetchMock
      .mockReturnValueOnce(reply(200, { goal: null }))
      .mockReturnValueOnce(reply(200, { success: true }));
    render(<TodayFocusHero />);

    const input = await screen.findByRole("textbox");
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();

    fireEvent.change(input, { target: { value: "  Ship issue #3776 tests  " } });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    expect(await screen.findByText("Ship issue #3776 tests")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/daily-focus",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal_text: "Ship issue #3776 tests",
            date: todayStorageKey().replace("devtrack_today_goal_", ""),
          }),
        })
      );
    });
    expect(window.localStorage.getItem(todayStorageKey())).toBe(
      "Ship issue #3776 tests"
    );
  });

  it("allows editing an existing goal", async () => {
    fetchMock
      .mockReturnValueOnce(reply(200, { goal: "Existing goal" }))
      .mockReturnValueOnce(reply(200, { success: true }));
    render(<TodayFocusHero />);

    expect(await screen.findByText("Existing goal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("textbox")).toHaveValue("Existing goal");
  });

  it("clears the saved goal and returns to the empty form", async () => {
    fetchMock
      .mockReturnValueOnce(reply(200, { goal: "To be cleared" }))
      .mockReturnValueOnce(reply(200, { success: true }));
    render(<TodayFocusHero />);

    expect(await screen.findByText("To be cleared")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(await screen.findByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringMatching(/^\/api\/daily-focus\?date=\d{4}-\d{2}-\d{2}$/),
        { method: "DELETE" }
      );
    });
    expect(window.localStorage.getItem(todayStorageKey())).toBeNull();
  });
});
