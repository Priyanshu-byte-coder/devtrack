import React from "react";
import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ProjectTutorClient from "../../src/components/ProjectTutorClient";

function mockResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

const SAMPLE_ANALYSIS =
  "React is a declarative, efficient, and flexible JavaScript library for building user interfaces.";

const SAMPLE_QUESTIONS = {
  easy: [
    "What is the difference between state and props in React?",
    "What is JSX and how does Babel transform it?",
  ],
  medium: [
    "How does React's virtual DOM diffing algorithm work?",
    "When should you use useMemo versus useCallback?",
  ],
  advanced: [
    "Explain how React Fiber achieves incremental rendering and concurrency.",
    "How does the lane priority model work in React 18?",
  ],
};

describe("ProjectTutorClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the initial form with disabled analyze button and helpful placeholder note", () => {
    render(<ProjectTutorClient />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Project tutor" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Paste a GitHub repository to get an overview, likely interview questions and a tutor you can quiz."
      )
    ).toBeInTheDocument();

    const input = screen.getByLabelText("GitHub repository URL");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute(
      "placeholder",
      "https://github.com/owner/repo"
    );
    expect(input).toHaveValue("");

    const analyzeButton = screen.getByRole("button", { name: "Analyze" });
    expect(analyzeButton).toBeInTheDocument();
    expect(analyzeButton).toBeDisabled();

    expect(
      screen.getByText(
        "Works best with your own projects: the tutor reads the README, languages and structure."
      )
    ).toBeInTheDocument();

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("enables the analyze button when a non-empty repository URL is entered", () => {
    render(<ProjectTutorClient />);

    const input = screen.getByLabelText("GitHub repository URL");
    const analyzeButton = screen.getByRole("button", { name: "Analyze" });

    fireEvent.change(input, {
      target: { value: "https://github.com/facebook/react" },
    });
    expect(analyzeButton).not.toBeDisabled();

    fireEvent.change(input, { target: { value: "   " } });
    expect(analyzeButton).toBeDisabled();
  });

  it("displays loading state while analysis is pending", async () => {
    let resolveAnalysis: (val: Response) => void;
    let resolveQuestions: (val: Response) => void;

    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) || "{}");
      if (body.action === "analyze") {
        return new Promise<Response>((resolve) => {
          resolveAnalysis = resolve;
        });
      }
      if (body.action === "questions") {
        return new Promise<Response>((resolve) => {
          resolveQuestions = resolve;
        });
      }
      return mockResponse({});
    });

    render(<ProjectTutorClient />);

    const input = screen.getByLabelText("GitHub repository URL");
    fireEvent.change(input, {
      target: { value: "https://github.com/facebook/react" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    expect(screen.getByRole("button", { name: "Analyzing…" })).toBeDisabled();
    expect(screen.getByText("Analyzing repository")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Works best with your own projects: the tutor reads the README, languages and structure."
      )
    ).not.toBeInTheDocument();

    // Resolve requests to clean up
    resolveAnalysis!(
      new Response(JSON.stringify({ analysis: SAMPLE_ANALYSIS }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    resolveQuestions!(
      new Response(JSON.stringify({ questions: SAMPLE_QUESTIONS }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Analyze" })
      ).toBeInTheDocument();
    });
  });

  it("displays an alert error message when the API request fails with a network error", async () => {
    fetchMock.mockRejectedValue(new Error("Network connection lost"));

    render(<ProjectTutorClient />);

    const input = screen.getByLabelText("GitHub repository URL");
    fireEvent.change(input, {
      target: { value: "https://github.com/facebook/react" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Network connection lost");
    expect(screen.getByRole("button", { name: "Analyze" })).not.toBeDisabled();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("displays an alert error message when the API returns an error status and payload", async () => {
    fetchMock.mockImplementation(() =>
      mockResponse(
        { error: "Repository is private or cannot be accessed." },
        403
      )
    );

    render(<ProjectTutorClient />);

    const input = screen.getByLabelText("GitHub repository URL");
    fireEvent.change(input, {
      target: { value: "https://github.com/private/repo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Repository is private or cannot be accessed."
    );
  });

  it("displays fallback error message when error response lacks specific text", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response("Internal Server Error", { status: 500 }))
    );

    render(<ProjectTutorClient />);

    const input = screen.getByLabelText("GitHub repository URL");
    fireEvent.change(input, {
      target: { value: "https://github.com/owner/failing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The tutor is unavailable right now.");
  });

  it("displays analysis overview after successful repository analysis", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) || "{}");
      if (body.action === "analyze") {
        return mockResponse({ analysis: SAMPLE_ANALYSIS });
      }
      if (body.action === "questions") {
        return mockResponse({ questions: SAMPLE_QUESTIONS });
      }
      return mockResponse({});
    });

    render(<ProjectTutorClient />);

    const input = screen.getByLabelText("GitHub repository URL");
    fireEvent.change(input, {
      target: { value: "https://github.com/facebook/react" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await waitFor(() => {
      expect(
        screen.getByRole("tablist", { name: "Project tutor sections" })
      ).toBeInTheDocument();
    });

    const overviewTab = screen.getByRole("tab", { name: "Overview" });
    expect(overviewTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(SAMPLE_ANALYSIS)).toBeInTheDocument();
  });

  it("renders interview questions grouped by level when navigating to questions tab", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) || "{}");
      if (body.action === "analyze") {
        return mockResponse({ analysis: SAMPLE_ANALYSIS });
      }
      if (body.action === "questions") {
        return mockResponse({ questions: SAMPLE_QUESTIONS });
      }
      return mockResponse({});
    });

    render(<ProjectTutorClient />);

    const input = screen.getByLabelText("GitHub repository URL");
    fireEvent.change(input, {
      target: { value: "https://github.com/facebook/react" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    const questionsTab = await screen.findByRole("tab", {
      name: "Interview questions",
    });
    fireEvent.click(questionsTab);

    expect(questionsTab).toHaveAttribute("aria-selected", "true");

    expect(
      screen.getByRole("heading", { level: 2, name: "Warm-up" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Core" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Deep dive" })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "What is the difference between state and props in React?"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("How does React's virtual DOM diffing algorithm work?")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Explain how React Fiber achieves incremental rendering and concurrency."
      )
    ).toBeInTheDocument();
  });

  it("handles empty overview and questions gracefully", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) || "{}");
      if (body.action === "analyze") {
        return mockResponse({ analysis: "" });
      }
      if (body.action === "questions") {
        return mockResponse({ questions: null });
      }
      return mockResponse({});
    });

    render(<ProjectTutorClient />);

    const input = screen.getByLabelText("GitHub repository URL");
    fireEvent.change(input, {
      target: { value: "https://github.com/empty/repo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    // When both analysis is empty and questions is null, hasResults is false
    await waitFor(() => {
      expect(
        screen.getByText(
          "Works best with your own projects: the tutor reads the README, languages and structure."
        )
      ).toBeInTheDocument();
    });
  });

  it("handles partial results where analysis exists but questions is null", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) || "{}");
      if (body.action === "analyze") {
        return mockResponse({ analysis: "Analysis only." });
      }
      if (body.action === "questions") {
        return mockResponse({ questions: null });
      }
      return mockResponse({});
    });

    render(<ProjectTutorClient />);

    const input = screen.getByLabelText("GitHub repository URL");
    fireEvent.change(input, {
      target: { value: "https://github.com/partial/repo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    const questionsTab = await screen.findByRole("tab", {
      name: "Interview questions",
    });
    fireEvent.click(questionsTab);

    expect(
      screen.getByText("No questions were generated for this repository.")
    ).toBeInTheDocument();
  });

  it("handles partial results where questions exist but analysis is empty", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) || "{}");
      if (body.action === "analyze") {
        return mockResponse({ analysis: "" });
      }
      if (body.action === "questions") {
        return mockResponse({ questions: SAMPLE_QUESTIONS });
      }
      return mockResponse({});
    });

    render(<ProjectTutorClient />);

    const input = screen.getByLabelText("GitHub repository URL");
    fireEvent.change(input, {
      target: { value: "https://github.com/partial/repo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await waitFor(() => {
      expect(screen.getByRole("tablist")).toBeInTheDocument();
    });

    expect(
      screen.getByText("No overview was generated for this repository.")
    ).toBeInTheDocument();
  });

  it("supports interactive chat with the project tutor", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) || "{}");
      if (body.action === "analyze") {
        return mockResponse({ analysis: SAMPLE_ANALYSIS });
      }
      if (body.action === "questions") {
        return mockResponse({ questions: SAMPLE_QUESTIONS });
      }
      if (body.action === "chat") {
        return mockResponse({
          answer:
            "React Fiber uses linked-list fibers to pause and resume work units.",
        });
      }
      return mockResponse({});
    });

    render(<ProjectTutorClient />);

    // Analyze first
    const repoInput = screen.getByLabelText("GitHub repository URL");
    fireEvent.change(repoInput, {
      target: { value: "https://github.com/facebook/react" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    const chatTab = await screen.findByRole("tab", { name: "Ask the tutor" });
    fireEvent.click(chatTab);

    expect(chatTab).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByText(
        "Ask about design decisions, trade-offs or how a part of the project works."
      )
    ).toBeInTheDocument();

    const chatInput = screen.getByPlaceholderText("Ask about this project…");
    const sendButton = screen.getByRole("button", { name: "Send" });

    // Send button disabled when empty
    expect(sendButton).toBeDisabled();

    // Type a question
    fireEvent.change(chatInput, {
      target: { value: "How does Fiber pause and resume work?" },
    });
    expect(sendButton).not.toBeDisabled();

    // Submit question
    fireEvent.click(sendButton);

    // Question appears in chat history
    expect(
      screen.getByText("How does Fiber pause and resume work?")
    ).toBeInTheDocument();

    // Response arrives
    await waitFor(() => {
      expect(
        screen.getByText(
          "React Fiber uses linked-list fibers to pause and resume work units."
        )
      ).toBeInTheDocument();
    });

    // Chat input cleared
    expect(chatInput).toHaveValue("");
    expect(sendButton).toBeDisabled();

    // Verify postTutor parameters
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/project-tutor",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          repoUrl: "https://github.com/facebook/react",
          action: "chat",
          question: "How does Fiber pause and resume work?",
        }),
      })
    );
  });

  it("handles chat errors gracefully by adding the error message as AI response", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) || "{}");
      if (body.action === "analyze") {
        return mockResponse({ analysis: SAMPLE_ANALYSIS });
      }
      if (body.action === "questions") {
        return mockResponse({ questions: SAMPLE_QUESTIONS });
      }
      if (body.action === "chat") {
        return mockResponse(
          { error: "AI rate limit exceeded. Please wait a moment." },
          429
        );
      }
      return mockResponse({});
    });

    render(<ProjectTutorClient />);

    const repoInput = screen.getByLabelText("GitHub repository URL");
    fireEvent.change(repoInput, {
      target: { value: "https://github.com/facebook/react" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    const chatTab = await screen.findByRole("tab", { name: "Ask the tutor" });
    fireEvent.click(chatTab);

    const chatInput = screen.getByPlaceholderText("Ask about this project…");
    fireEvent.change(chatInput, { target: { value: "Tell me more" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(
        screen.getByText("AI rate limit exceeded. Please wait a moment.")
      ).toBeInTheDocument();
    });
  });

  it("handles fallback chat response when no answer is returned", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) || "{}");
      if (body.action === "analyze") {
        return mockResponse({ analysis: SAMPLE_ANALYSIS });
      }
      if (body.action === "questions") {
        return mockResponse({ questions: SAMPLE_QUESTIONS });
      }
      if (body.action === "chat") {
        return mockResponse({});
      }
      return mockResponse({});
    });

    render(<ProjectTutorClient />);

    const repoInput = screen.getByLabelText("GitHub repository URL");
    fireEvent.change(repoInput, {
      target: { value: "https://github.com/facebook/react" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    const chatTab = await screen.findByRole("tab", { name: "Ask the tutor" });
    fireEvent.click(chatTab);

    const chatInput = screen.getByPlaceholderText("Ask about this project…");
    fireEvent.change(chatInput, { target: { value: "Any thoughts?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("No response.")).toBeInTheDocument();
    });
  });
});
