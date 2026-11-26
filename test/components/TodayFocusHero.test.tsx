import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("TodayFocusHero", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("displays the prompt as a visible label and uses a short placeholder", async () => {
    fetchMock.mockReturnValue(reply(200, { goal: null }));
    render(<TodayFocusHero />);

    // Wait for component to mount
    const input = await screen.findByRole("textbox");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "e.g. Fix the login bug…");

    // Check visible label text above input
    const label = screen.getByText(/today\?/i);
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute("for", "today-focus-input");
  });

  it("saves a new focus goal and displays it", async () => {
    fetchMock
      .mockReturnValueOnce(reply(200, { goal: null }))
      .mockReturnValueOnce(reply(200, { success: true }));

    render(<TodayFocusHero />);

    const input = await screen.findByRole("textbox");
    const saveButton = screen.getByRole("button", { name: "Save" });

    expect(saveButton).toBeDisabled();

    fireEvent.change(input, { target: { value: "Ship issue #3712 fix" } });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText("Ship issue #3712 fix")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("allows editing an existing goal", async () => {
    fetchMock
      .mockReturnValueOnce(reply(200, { goal: "Existing goal" }))
      .mockReturnValueOnce(reply(200, { success: true }));

    render(<TodayFocusHero />);

    expect(await screen.findByText("Existing goal")).toBeInTheDocument();

    const editButton = screen.getByRole("button", { name: "Edit" });
    fireEvent.click(editButton);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Existing goal");
  });

  it("clears a goal when Done is clicked", async () => {
    fetchMock
      .mockReturnValueOnce(reply(200, { goal: "To be cleared" }))
      .mockReturnValueOnce(reply(200, { success: true }));

    render(<TodayFocusHero />);

    expect(await screen.findByText("To be cleared")).toBeInTheDocument();

    const doneButton = screen.getByRole("button", { name: "Done" });
    fireEvent.click(doneButton);

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });
});
