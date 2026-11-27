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
import ExportButton from "../../src/components/ExportButton";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockDoc = {
  internal: {
    pageSize: {
      getWidth: vi.fn(() => 210),
      getHeight: vi.fn(() => 297),
    },
  },
  getNumberOfPages: vi.fn(() => 2),
  setPage: vi.fn(),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setTextColor: vi.fn(),
  setFillColor: vi.fn(),
  setDrawColor: vi.fn(),
  text: vi.fn(),
  line: vi.fn(),
  roundedRect: vi.fn(),
  save: vi.fn(),
};

vi.mock("jspdf", () => {
  const MockJsPDF = vi.fn(function (this: any) {
    return mockDoc;
  });
  return {
    default: MockJsPDF,
  };
});

vi.mock("jspdf-autotable", () => ({
  default: vi.fn().mockImplementation((doc: any) => {
    doc.lastAutoTable = { finalY: 120 };
  }),
}));

function mockJsonResponse(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

const SAMPLE_PR_DATA = {
  open: 3,
  merged: 15,
  avgReviewHours: 4.5,
  mergeRate: "83.3%",
};

const SAMPLE_GOALS_DATA = {
  goals: [
    {
      id: "goal-1",
      title: "Write documentation",
      target: 10,
      current: 10,
    },
    {
      id: "goal-2",
      title: 'Fix issue "Bug #1", handle, commas & newlines',
      target: 20,
      current: 8,
    },
    {
      id: "goal-3",
      title: "Refactor legacy code",
      target: 5,
      current: 0,
    },
  ],
};

const SAMPLE_CONTRIBUTIONS_DATA = {
  data: {
    "2026-01-10": 5,
    "2026-01-11": 12,
    "2026-02-05": 3,
  },
};

const SAMPLE_DB_EXPORT_DATA = {
  sections: {
    user: { id: "user-123", email: "alice@example.com" },
    settings: { theme: "dark" },
  },
};

describe("ExportButton", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let createdBlobs: Blob[] = [];
  let downloadedFiles: { filename: string; url: string; content?: string }[] =
    [];

  beforeEach(() => {
    createdBlobs = [];
    downloadedFiles = [];

    vi.mocked(useSession).mockReturnValue({
      data: {
        githubLogin: "alice",
        user: { name: "Alice Smith" },
      },
      status: "authenticated",
    } as any);

    fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/metrics/prs")) {
        return mockJsonResponse(SAMPLE_PR_DATA);
      }
      if (url.includes("/api/goals")) {
        return mockJsonResponse(SAMPLE_GOALS_DATA);
      }
      if (url.includes("/api/metrics/contributions")) {
        return mockJsonResponse(SAMPLE_CONTRIBUTIONS_DATA);
      }
      if (url.includes("/api/user/data-export")) {
        return mockJsonResponse(SAMPLE_DB_EXPORT_DATA);
      }
      return mockJsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    vi.spyOn(URL, "createObjectURL").mockImplementation(
      (blob: Blob | MediaSource) => {
        createdBlobs.push(blob as Blob);
        return `blob:mock-url-${createdBlobs.length}`;
      }
    );
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloadedFiles.push({
        filename: this.download,
        url: this.href,
      });
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("Initial rendering and accessibility", () => {
    it("renders the export dropdown trigger in closed state", () => {
      render(<ExportButton />);

      const summary = screen.getByText("Export");
      expect(summary).toBeInTheDocument();
      expect(summary.tagName.toLowerCase()).toBe("summary");

      const details = summary.closest("details");
      expect(details).not.toHaveAttribute("open");
    });

    it("displays accessible CSV, PDF, and JSON options when opened", () => {
      render(<ExportButton />);

      const csvButton = screen.getByRole("button", {
        name: "Export dashboard metrics as CSV",
      });
      const pdfButton = screen.getByRole("button", {
        name: "Export dashboard metrics as PDF",
      });
      const jsonButton = screen.getByRole("button", {
        name: "Export dashboard metrics as JSON",
      });

      expect(csvButton).toBeInTheDocument();
      expect(csvButton).toHaveTextContent("Export CSV");

      expect(pdfButton).toBeInTheDocument();
      expect(pdfButton).toHaveTextContent("Export PDF");

      expect(jsonButton).toBeInTheDocument();
      expect(jsonButton).toHaveTextContent("Export JSON");
    });

    it("removes the open attribute on details when an export option is clicked", async () => {
      render(<ExportButton />);

      const summary = screen.getByText("Export");
      const details = summary.closest("details")!;
      details.setAttribute("open", "");
      expect(details).toHaveAttribute("open");

      const csvButton = screen.getByRole("button", {
        name: "Export dashboard metrics as CSV",
      });
      fireEvent.click(csvButton);

      expect(details).not.toHaveAttribute("open");
    });
  });

  describe("Loading states", () => {
    it("shows loading state while CSV export is in progress and resets when completed", async () => {
      let resolvePrs: (res: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePrs = resolve;
      });

      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes("/api/metrics/prs")) {
          return pendingPromise;
        }
        if (url.includes("/api/goals")) {
          return mockJsonResponse(SAMPLE_GOALS_DATA);
        }
        if (url.includes("/api/metrics/contributions")) {
          return mockJsonResponse(SAMPLE_CONTRIBUTIONS_DATA);
        }
        return mockJsonResponse(SAMPLE_DB_EXPORT_DATA);
      });

      render(<ExportButton />);

      const csvButton = screen.getByRole("button", {
        name: "Export dashboard metrics as CSV",
      });
      fireEvent.click(csvButton);

      // Verify exporting state
      expect(screen.getByText("Exporting…")).toBeInTheDocument();
      expect(csvButton).toHaveTextContent("Exporting CSV…");
      expect(csvButton).toBeDisabled();

      // PDF and JSON options should not be marked as pending
      expect(
        screen.getByRole("button", { name: "Export dashboard metrics as PDF" })
      ).not.toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Export dashboard metrics as JSON" })
      ).not.toBeDisabled();

      // Resolve the pending request
      resolvePrs!(
        new Response(JSON.stringify(SAMPLE_PR_DATA), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      await waitFor(() => {
        expect(screen.getByText("Export")).toBeInTheDocument();
      });
      expect(csvButton).toHaveTextContent("Export CSV");
      expect(csvButton).not.toBeDisabled();
    });

    it("shows loading state while PDF export is in progress and resets when completed", async () => {
      let resolveGoals: (res: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolveGoals = resolve;
      });

      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes("/api/goals")) {
          return pendingPromise;
        }
        if (url.includes("/api/metrics/prs")) {
          return mockJsonResponse(SAMPLE_PR_DATA);
        }
        if (url.includes("/api/metrics/contributions")) {
          return mockJsonResponse(SAMPLE_CONTRIBUTIONS_DATA);
        }
        return mockJsonResponse(SAMPLE_DB_EXPORT_DATA);
      });

      render(<ExportButton />);

      const pdfButton = screen.getByRole("button", {
        name: "Export dashboard metrics as PDF",
      });
      fireEvent.click(pdfButton);

      expect(screen.getByText("Exporting…")).toBeInTheDocument();
      expect(pdfButton).toHaveTextContent("Exporting PDF…");
      expect(pdfButton).toBeDisabled();

      resolveGoals!(
        new Response(JSON.stringify(SAMPLE_GOALS_DATA), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      await waitFor(() => {
        expect(screen.getByText("Export")).toBeInTheDocument();
      });
      expect(pdfButton).toHaveTextContent("Export PDF");
      expect(pdfButton).not.toBeDisabled();
    });

    it("shows loading state while JSON export is in progress and resets when completed", async () => {
      let resolveContrib: (res: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolveContrib = resolve;
      });

      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes("/api/metrics/contributions")) {
          return pendingPromise;
        }
        if (url.includes("/api/metrics/prs")) {
          return mockJsonResponse(SAMPLE_PR_DATA);
        }
        if (url.includes("/api/goals")) {
          return mockJsonResponse(SAMPLE_GOALS_DATA);
        }
        return mockJsonResponse(SAMPLE_DB_EXPORT_DATA);
      });

      render(<ExportButton />);

      const jsonButton = screen.getByRole("button", {
        name: "Export dashboard metrics as JSON",
      });
      fireEvent.click(jsonButton);

      expect(screen.getByText("Exporting…")).toBeInTheDocument();
      expect(jsonButton).toHaveTextContent("Exporting JSON…");
      expect(jsonButton).toBeDisabled();

      resolveContrib!(
        new Response(JSON.stringify(SAMPLE_CONTRIBUTIONS_DATA), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      await waitFor(() => {
        expect(screen.getByText("Export")).toBeInTheDocument();
      });
      expect(jsonButton).toHaveTextContent("Export JSON");
      expect(jsonButton).not.toBeDisabled();
    });
  });

  describe("Error handling and partial-data fallback", () => {
    it("handles rejected network request during CSV export and displays error toast", async () => {
      fetchMock.mockRejectedValue(new Error("Network connection dropped"));

      render(<ExportButton />);

      const csvButton = screen.getByRole("button", {
        name: "Export dashboard metrics as CSV",
      });
      fireEvent.click(csvButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to export CSV. Please try again."
        );
      });
      expect(screen.getByText("Export")).toBeInTheDocument();
      expect(csvButton).not.toBeDisabled();
    });

    it("handles rejected network request during PDF export and displays error toast", async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes("/api/goals")) {
          throw new Error("Failed to fetch goals");
        }
        return mockJsonResponse({});
      });

      render(<ExportButton />);

      const pdfButton = screen.getByRole("button", {
        name: "Export dashboard metrics as PDF",
      });
      fireEvent.click(pdfButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to export PDF. Please try again."
        );
      });
      expect(screen.getByText("Export")).toBeInTheDocument();
      expect(pdfButton).not.toBeDisabled();
    });

    it("handles rejected network request during JSON export and displays error toast", async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes("/api/metrics/contributions")) {
          throw new Error("Failed to fetch contributions");
        }
        return mockJsonResponse({});
      });

      render(<ExportButton />);

      const jsonButton = screen.getByRole("button", {
        name: "Export dashboard metrics as JSON",
      });
      fireEvent.click(jsonButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to export JSON. Please try again."
        );
      });
      expect(screen.getByText("Export")).toBeInTheDocument();
      expect(jsonButton).not.toBeDisabled();
    });

    it("handles non-OK HTTP responses with graceful partial-data fallbacks without throwing", async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes("/api/metrics/prs")) {
          return new Response("Not Found", { status: 404 });
        }
        if (url.includes("/api/goals")) {
          return new Response("Server Error", { status: 500 });
        }
        if (url.includes("/api/metrics/contributions")) {
          return new Response("Unauthorized", { status: 401 });
        }
        if (url.includes("/api/user/data-export")) {
          return new Response("Not Found", { status: 404 });
        }
        return mockJsonResponse({});
      });

      render(<ExportButton />);

      const csvButton = screen.getByRole("button", {
        name: "Export dashboard metrics as CSV",
      });
      fireEvent.click(csvButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "CSV exported successfully."
        );
      });

      expect(downloadedFiles.length).toBe(1);
      expect(downloadedFiles[0].filename).toBe("dashboard-metrics.csv");
    });
  });

  describe("Empty-data behavior", () => {
    it("exports CSV successfully with empty collections and zero counts", async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes("/api/metrics/prs")) {
          return mockJsonResponse({
            open: 0,
            merged: 0,
            avgReviewHours: 0,
            mergeRate: "0%",
          });
        }
        if (url.includes("/api/goals")) {
          return mockJsonResponse({ goals: [] });
        }
        if (url.includes("/api/metrics/contributions")) {
          return mockJsonResponse({ data: {} });
        }
        return mockJsonResponse({ sections: {} });
      });

      render(<ExportButton />);

      const csvButton = screen.getByRole("button", {
        name: "Export dashboard metrics as CSV",
      });
      fireEvent.click(csvButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "CSV exported successfully."
        );
      });

      expect(createdBlobs.length).toBe(1);
      const csvContent = await createdBlobs[0].text();
      expect(csvContent).toContain("Report Summary");
      expect(csvContent).toContain("Total commits,0");
      expect(csvContent).toContain("Total goals,0");
      expect(csvContent).toContain(
        "No active commit days were captured in this report."
      );
      expect(csvContent).toContain("No goals were included in this export.");
    });

    it("exports JSON successfully with empty collections and null database records", async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes("/api/metrics/prs")) {
          return mockJsonResponse(null, 404);
        }
        if (url.includes("/api/goals")) {
          return mockJsonResponse({ goals: [] });
        }
        if (url.includes("/api/metrics/contributions")) {
          return mockJsonResponse({ data: {} });
        }
        if (url.includes("/api/user/data-export")) {
          return mockJsonResponse(null, 404);
        }
        return mockJsonResponse({});
      });

      render(<ExportButton />);

      const jsonButton = screen.getByRole("button", {
        name: "Export dashboard metrics as JSON",
      });
      fireEvent.click(jsonButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "JSON exported successfully."
        );
      });

      expect(createdBlobs.length).toBe(1);
      const jsonContent = await createdBlobs[0].text();
      const parsed = JSON.parse(jsonContent);

      expect(parsed.summary.totalCommits).toBe(0);
      expect(parsed.summary.activeCodingDays).toBe(0);
      expect(parsed.summary.totalGoals).toBe(0);
      expect(parsed.goals).toEqual([]);
      expect(parsed.commitActivity).toEqual([]);
      expect(parsed.databaseRecords).toBeNull();
    });
  });

  describe("Successful CSV export", () => {
    it("generates correctly formatted CSV with escaped characters, triggers download and cleanup", async () => {
      render(<ExportButton />);

      const csvButton = screen.getByRole("button", {
        name: "Export dashboard metrics as CSV",
      });
      fireEvent.click(csvButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "CSV exported successfully."
        );
      });

      expect(downloadedFiles.length).toBe(1);
      expect(downloadedFiles[0].filename).toBe("dashboard-metrics.csv");

      expect(createdBlobs.length).toBe(1);
      const blob = createdBlobs[0];
      expect(blob.type).toBe("text/csv");

      const csvText = await blob.text();
      expect(csvText).toContain("Report Summary");
      expect(csvText).toContain("GitHub user,@alice");
      expect(csvText).toContain("Total commits,20");
      expect(csvText).toContain("Active coding days,3");
      expect(csvText).toContain("PR Metrics");
      expect(csvText).toContain("Goals Tracker");
      expect(csvText).toContain("Commit Activity");
      expect(csvText).toContain("Monthly Summary");
      expect(csvText).toContain("Goal Status Overview");

      // Verify escaping for goal title with quotes, comma, and newline
      expect(csvText).toContain(
        '"Fix issue ""Bug #1"", handle, commas & newlines"'
      );

      // Verify URL revocation
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(downloadedFiles[0].url);
    });
  });

  describe("Successful PDF export", () => {
    it("invokes jsPDF document operations, autoTable, and triggers file save", async () => {
      render(<ExportButton />);

      const pdfButton = screen.getByRole("button", {
        name: "Export dashboard metrics as PDF",
      });
      fireEvent.click(pdfButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "PDF exported successfully."
        );
      });

      expect(jsPDF).toHaveBeenCalled();
      expect(mockDoc.setFontSize).toHaveBeenCalled();
      expect(mockDoc.setFont).toHaveBeenCalled();
      expect(mockDoc.setTextColor).toHaveBeenCalled();
      expect(mockDoc.text).toHaveBeenCalled();
      expect(mockDoc.roundedRect).toHaveBeenCalled();
      expect(mockDoc.line).toHaveBeenCalled();
      expect(mockDoc.setPage).toHaveBeenCalled();

      expect(autoTable).toHaveBeenCalled();
      expect(mockDoc.save).toHaveBeenCalledWith(
        expect.stringMatching(/^devtrack-export-alice-\d{4}-\d{2}-\d{2}\.pdf$/)
      );
    });
  });

  describe("Successful JSON export", () => {
    it("generates valid JSON with complete metrics, goals, and database records", async () => {
      render(<ExportButton />);

      const jsonButton = screen.getByRole("button", {
        name: "Export dashboard metrics as JSON",
      });
      fireEvent.click(jsonButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "JSON exported successfully."
        );
      });

      expect(downloadedFiles.length).toBe(1);
      expect(downloadedFiles[0].filename).toMatch(
        /^devtrack-export-alice-\d{4}-\d{2}-\d{2}\.json$/
      );

      expect(createdBlobs.length).toBe(1);
      const blob = createdBlobs[0];
      expect(blob.type).toBe("application/json");

      const jsonText = await blob.text();
      const parsed = JSON.parse(jsonText);

      expect(parsed.githubUser).toBe("alice");
      expect(parsed.summary.totalCommits).toBe(20);
      expect(parsed.summary.activeCodingDays).toBe(3);
      expect(parsed.summary.highestCommitsInOneDay).toBe(12);
      expect(parsed.summary.totalGoals).toBe(3);
      expect(parsed.prMetrics).toEqual(SAMPLE_PR_DATA);
      expect(parsed.goals).toHaveLength(3);
      expect(parsed.commitActivity).toHaveLength(3);
      expect(parsed.databaseRecords).toEqual(SAMPLE_DB_EXPORT_DATA.sections);

      expect(URL.revokeObjectURL).toHaveBeenCalledWith(downloadedFiles[0].url);
    });
  });

  describe("Session and report naming behavior", () => {
    it("falls back to session.user.name when githubLogin is absent", async () => {
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { name: "BobBuilder" },
        },
        status: "authenticated",
      } as any);

      render(<ExportButton />);

      const jsonButton = screen.getByRole("button", {
        name: "Export dashboard metrics as JSON",
      });
      fireEvent.click(jsonButton);

      await waitFor(() => {
        expect(downloadedFiles.length).toBe(1);
      });

      expect(downloadedFiles[0].filename).toMatch(
        /^devtrack-export-BobBuilder-\d{4}-\d{2}-\d{2}\.json$/
      );
    });

    it("falls back to metrics filename and unknown user when no session is provided", async () => {
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: "unauthenticated",
      } as any);

      render(<ExportButton />);

      const jsonButton = screen.getByRole("button", {
        name: "Export dashboard metrics as JSON",
      });
      fireEvent.click(jsonButton);

      await waitFor(() => {
        expect(downloadedFiles.length).toBe(1);
      });

      expect(downloadedFiles[0].filename).toMatch(
        /^devtrack-export-metrics-\d{4}-\d{2}-\d{2}\.json$/
      );

      const parsed = JSON.parse(await createdBlobs[0].text());
      expect(parsed.githubUser).toBe("unknown");
    });
  });
});
