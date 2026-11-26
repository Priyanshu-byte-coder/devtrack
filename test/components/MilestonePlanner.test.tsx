import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MilestonePlanner from "../../src/components/MilestonePlanner";

function reply(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

const mockMilestones = [
  {
    id: "m-1",
    title: "Reach 500 commits",
    description: "Consistent coding every weekday",
    target_value: 500,
    current_value: 250,
    unit: "Commits",
    target_date: "2026-12-31",
    created_at: "2026-01-01T00:00:00Z",
    category: "commits" as const,
  },
  {
    id: "m-2",
    title: "Ship 5 Projects",
    description: "Launch 5 side projects",
    target_value: 5,
    current_value: 5,
    unit: "Projects",
    target_date: "2026-06-30",
    created_at: "2026-01-01T00:00:00Z",
    category: "projects" as const,
  },
];

describe("MilestonePlanner Component", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("displays loading indicator while fetch is pending and clears it upon completion", async () => {
      let resolvePromise!: (val: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      fetchMock.mockReturnValue(pendingPromise);

      render(<MilestonePlanner />);

      expect(screen.getByText("Loading milestones…")).toBeInTheDocument();
      expect(screen.queryByText("Reach 500 commits")).not.toBeInTheDocument();

      resolvePromise(
        new Response(JSON.stringify({ milestones: mockMilestones }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

      await waitFor(() => {
        expect(
          screen.queryByText("Loading milestones…")
        ).not.toBeInTheDocument();
      });

      expect(screen.getByText("Reach 500 commits")).toBeInTheDocument();
    });

    it("clears loading indicator even if initial request fails", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));

      render(<MilestonePlanner />);

      expect(screen.getByText("Loading milestones…")).toBeInTheDocument();

      await waitFor(() => {
        expect(
          screen.queryByText("Loading milestones…")
        ).not.toBeInTheDocument();
      });

      expect(
        screen.getByText(
          "No milestones yet. Set a big target and track the climb."
        )
      ).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("renders empty state message when no milestones exist", async () => {
      fetchMock.mockReturnValue(reply(200, { milestones: [] }));

      render(<MilestonePlanner />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading milestones…")
        ).not.toBeInTheDocument();
      });

      expect(
        screen.getByText(
          "No milestones yet. Set a big target and track the climb."
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add milestone/i })
      ).toBeInTheDocument();
    });
  });

  describe("Main Content Rendering", () => {
    it("renders milestone details, summary chips, and counts", async () => {
      fetchMock.mockReturnValue(reply(200, { milestones: mockMilestones }));

      render(<MilestonePlanner />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading milestones…")
        ).not.toBeInTheDocument();
      });

      // Heading and badge count
      expect(screen.getByText("Milestone Planner")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();

      // Milestone 1 (in-progress)
      expect(screen.getByText("Reach 500 commits")).toBeInTheDocument();
      expect(screen.getByText(/250\/500 Commits/)).toBeInTheDocument();
      expect(screen.getByText("50% complete")).toBeInTheDocument();

      // Milestone 2 (completed)
      expect(screen.getByText("Ship 5 Projects")).toBeInTheDocument();
      expect(screen.getByText(/5\/5 Projects/)).toBeInTheDocument();
      expect(screen.getByText("100% complete")).toBeInTheDocument();
      expect(screen.getAllByText("Completed").length).toBeGreaterThanOrEqual(1);
    });

    it("expands and collapses milestone details", async () => {
      fetchMock.mockReturnValue(reply(200, { milestones: mockMilestones }));

      render(<MilestonePlanner />);

      await waitFor(() => {
        expect(screen.getByText("Reach 500 commits")).toBeInTheDocument();
      });

      expect(
        screen.queryByText("Consistent coding every weekday")
      ).not.toBeInTheDocument();

      const expandBtn = screen.getByRole("button", {
        name: "Show details for Reach 500 commits",
      });
      fireEvent.click(expandBtn);

      expect(
        screen.getByText("Consistent coding every weekday")
      ).toBeInTheDocument();
      expect(expandBtn).toHaveAttribute(
        "aria-label",
        "Hide details for Reach 500 commits"
      );

      fireEvent.click(expandBtn);
      expect(
        screen.queryByText("Consistent coding every weekday")
      ).not.toBeInTheDocument();
    });

    it("shows completed milestone note when expanding a completed milestone", async () => {
      fetchMock.mockReturnValue(reply(200, { milestones: mockMilestones }));

      render(<MilestonePlanner />);

      await waitFor(() => {
        expect(screen.getByText("Ship 5 Projects")).toBeInTheDocument();
      });

      const expandBtn = screen.getByRole("button", {
        name: "Show details for Ship 5 Projects",
      });
      fireEvent.click(expandBtn);

      expect(screen.getByText("Launch 5 side projects")).toBeInTheDocument();
      expect(screen.getByText("★ Milestone achieved")).toBeInTheDocument();
    });
  });

  describe("Form Creation and Validation", () => {
    it("toggles the creation form open and closed via Cancel", async () => {
      fetchMock.mockReturnValue(reply(200, { milestones: [] }));

      render(<MilestonePlanner />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading milestones…")
        ).not.toBeInTheDocument();
      });

      const addBtn = screen.getByRole("button", { name: /add milestone/i });
      fireEvent.click(addBtn);

      expect(screen.getByLabelText(/title \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/target date \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/target value \*/i)).toBeInTheDocument();

      const cancelBtn = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelBtn);

      expect(screen.queryByLabelText(/title \*/i)).not.toBeInTheDocument();
    });

    it("successfully creates a new milestone", async () => {
      fetchMock.mockReturnValueOnce(reply(200, { milestones: [] }));

      render(<MilestonePlanner />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading milestones…")
        ).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /add milestone/i }));

      const newMilestone = {
        id: "m-new",
        title: "100 Active Days",
        description: "",
        target_value: 100,
        current_value: 10,
        unit: "Streak Days",
        target_date: "2026-12-31",
        created_at: new Date().toISOString(),
        category: "streak" as const,
      };

      fetchMock.mockReturnValueOnce(reply(201, { milestone: newMilestone }));

      fireEvent.change(screen.getByLabelText(/title \*/i), {
        target: { value: "100 Active Days" },
      });
      fireEvent.change(screen.getByLabelText(/category/i), {
        target: { value: "streak" },
      });
      fireEvent.change(screen.getByLabelText(/target date \*/i), {
        target: { value: "2026-12-31" },
      });
      fireEvent.change(screen.getByLabelText(/target value \*/i), {
        target: { value: "100" },
      });
      fireEvent.change(screen.getByLabelText(/current value/i), {
        target: { value: "10" },
      });

      const submitBtn = screen.getAllByRole("button", {
        name: /add milestone/i,
      })[1];
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText("100 Active Days")).toBeInTheDocument();
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/milestones",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "100 Active Days",
            description: "",
            targetValue: 100,
            currentValue: 10,
            unit: "Streak Days",
            targetDate: "2026-12-31",
            category: "streak",
          }),
        })
      );
    });

    it("displays error message when creation fails with an API error response", async () => {
      fetchMock.mockReturnValueOnce(reply(200, { milestones: [] }));

      render(<MilestonePlanner />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading milestones…")
        ).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /add milestone/i }));

      fetchMock.mockReturnValueOnce(
        reply(400, { error: "Invalid target date." })
      );

      fireEvent.change(screen.getByLabelText(/title \*/i), {
        target: { value: "Invalid Milestone" },
      });
      fireEvent.change(screen.getByLabelText(/target date \*/i), {
        target: { value: "2020-01-01" },
      });
      fireEvent.change(screen.getByLabelText(/target value \*/i), {
        target: { value: "50" },
      });

      fireEvent.click(
        screen.getAllByRole("button", { name: /add milestone/i })[1]
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Invalid target date."
        );
      });
    });

    it("displays error message when creation encounters a network error", async () => {
      fetchMock.mockReturnValueOnce(reply(200, { milestones: [] }));

      render(<MilestonePlanner />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading milestones…")
        ).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /add milestone/i }));

      fetchMock.mockRejectedValueOnce(new Error("Network disconnect"));

      fireEvent.change(screen.getByLabelText(/title \*/i), {
        target: { value: "Network Test" },
      });
      fireEvent.change(screen.getByLabelText(/target date \*/i), {
        target: { value: "2026-12-31" },
      });
      fireEvent.change(screen.getByLabelText(/target value \*/i), {
        target: { value: "10" },
      });

      fireEvent.click(
        screen.getAllByRole("button", { name: /add milestone/i })[1]
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Network error. Please try again."
        );
      });
    });
  });

  describe("Milestone Actions (Increment, Duplicate, Delete)", () => {
    it("increments progress when clicking +1 button", async () => {
      fetchMock.mockReturnValueOnce(reply(200, { milestones: mockMilestones }));

      render(<MilestonePlanner />);

      await waitFor(() => {
        expect(screen.getByText("Reach 500 commits")).toBeInTheDocument();
      });

      fetchMock.mockReturnValueOnce(reply(200, { success: true }));

      const incrementBtn = screen.getByRole("button", {
        name: "Add 1 to Reach 500 commits",
      });
      fireEvent.click(incrementBtn);

      expect(screen.getByText(/251\/500 Commits/)).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/milestones/m-1",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentValue: 251 }),
        })
      );
    });

    it("reverts increment on network failure", async () => {
      fetchMock.mockReturnValueOnce(reply(200, { milestones: mockMilestones }));

      render(<MilestonePlanner />);

      await waitFor(() => {
        expect(screen.getByText("Reach 500 commits")).toBeInTheDocument();
      });

      fetchMock.mockRejectedValueOnce(new Error("PATCH error"));

      const incrementBtn = screen.getByRole("button", {
        name: "Add 1 to Reach 500 commits",
      });
      fireEvent.click(incrementBtn);

      await waitFor(() => {
        expect(screen.getByText(/250\/500 Commits/)).toBeInTheDocument();
      });
    });

    it("disables +1 button when milestone is completed", async () => {
      fetchMock.mockReturnValueOnce(reply(200, { milestones: mockMilestones }));

      render(<MilestonePlanner />);

      await waitFor(() => {
        expect(screen.getByText("Ship 5 Projects")).toBeInTheDocument();
      });

      const completedIncrementBtn = screen.getByRole("button", {
        name: "Add 1 to Ship 5 Projects",
      });
      expect(completedIncrementBtn).toBeDisabled();
    });

    it("duplicates an existing milestone", async () => {
      fetchMock.mockReturnValueOnce(reply(200, { milestones: mockMilestones }));

      render(<MilestonePlanner />);

      await waitFor(() => {
        expect(screen.getByText("Reach 500 commits")).toBeInTheDocument();
      });

      const duplicated = {
        ...mockMilestones[0],
        id: "m-1-copy",
        title: "Reach 500 commits (Copy)",
      };
      fetchMock.mockReturnValueOnce(reply(201, { milestone: duplicated }));

      const duplicateBtn = screen.getByRole("button", {
        name: "Duplicate Reach 500 commits",
      });
      fireEvent.click(duplicateBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Reach 500 commits (Copy)")
        ).toBeInTheDocument();
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/milestones",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Reach 500 commits (Copy)",
            description: mockMilestones[0].description,
            targetValue: mockMilestones[0].target_value,
            currentValue: mockMilestones[0].current_value,
            unit: mockMilestones[0].unit,
            targetDate: mockMilestones[0].target_date,
            category: mockMilestones[0].category,
          }),
        })
      );
    });

    it("deletes a milestone", async () => {
      fetchMock.mockReturnValueOnce(reply(200, { milestones: mockMilestones }));

      render(<MilestonePlanner />);

      await waitFor(() => {
        expect(screen.getByText("Reach 500 commits")).toBeInTheDocument();
      });

      fetchMock.mockReturnValueOnce(reply(200, { success: true }));

      const deleteBtn = screen.getByRole("button", {
        name: "Delete Reach 500 commits",
      });
      fireEvent.click(deleteBtn);

      expect(screen.queryByText("Reach 500 commits")).not.toBeInTheDocument();

      expect(fetchMock).toHaveBeenCalledWith("/api/milestones/m-1", {
        method: "DELETE",
      });
    });
  });
});
