"use client";

import { useState } from "react";
import { MessageSquare, ListChecks, FileText, Send } from "lucide-react";
import PageHeader from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Questions {
  easy: string[];
  medium: string[];
  advanced: string[];
}

type Tab = "analysis" | "questions" | "chat";

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: "analysis", label: "Overview", icon: FileText },
  { id: "questions", label: "Interview questions", icon: ListChecks },
  { id: "chat", label: "Ask the tutor", icon: MessageSquare },
];

const LEVELS: { id: keyof Questions; label: string; dot: string }[] = [
  { id: "easy", label: "Warm-up", dot: "bg-emerald-500" },
  { id: "medium", label: "Core", dot: "bg-amber-500" },
  { id: "advanced", label: "Deep dive", dot: "bg-rose-500" },
];

async function postTutor(body: Record<string, string>) {
  const res = await fetch("/api/project-tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "The tutor is unavailable right now."
    );
  }
  return data;
}

const inputClass =
  "h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export default function ProjectTutorClient() {
  const [repoUrl, setRepoUrl] = useState("");
  const [analyzedRepo, setAnalyzedRepo] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [questions, setQuestions] = useState<Questions | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<
    { role: "user" | "ai"; text: string }[]
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("analysis");

  const handleAnalyze = async () => {
    const url = repoUrl.trim();
    if (!url) return;
    setLoading(true);
    setError("");
    setAnalysis("");
    setQuestions(null);
    setChatHistory([]);

    try {
      const [analysisData, questionsData] = await Promise.all([
        postTutor({ repoUrl: url, action: "analyze" }),
        postTutor({ repoUrl: url, action: "questions" }),
      ]);
      setAnalysis(analysisData.analysis ?? "");
      setQuestions(questionsData.questions ?? null);
      setAnalyzedRepo(url);
      setActiveTab("analysis");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to analyze repository. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    const question = chatInput.trim();
    if (!question || chatLoading) return;
    setChatInput("");
    setChatHistory((prev) => [...prev, { role: "user", text: question }]);
    setChatLoading(true);

    try {
      const data = await postTutor({
        repoUrl: analyzedRepo,
        action: "chat",
        question,
      });
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", text: data.answer ?? "No response." },
      ]);
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: "ai",
          text:
            err instanceof Error
              ? err.message
              : "Failed to get a response. Please try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const hasResults = Boolean(analysis || questions);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Project tutor"
        description="Paste a GitHub repository to get an overview, likely interview questions and a tutor you can quiz."
      />

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleAnalyze();
        }}
      >
        <label htmlFor="tutor-repo" className="sr-only">
          GitHub repository URL
        </label>
        <input
          id="tutor-repo"
          type="url"
          inputMode="url"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className={inputClass}
        />
        <Button type="submit" disabled={loading || !repoUrl.trim()}>
          {loading ? "Analyzing…" : "Analyze"}
        </Button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-[var(--destructive-muted-border)] bg-[var(--destructive-muted)] px-3 py-2 text-sm text-[var(--destructive)]"
        >
          {error}
        </p>
      )}

      {loading && (
        <div className="mt-6 space-y-3" aria-busy="true" aria-live="polite">
          <span className="sr-only">Analyzing repository</span>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-[var(--card-muted)]"
            />
          ))}
        </div>
      )}

      {!loading && !hasResults && !error && (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center text-sm text-[var(--muted-foreground)]">
          Works best with your own projects: the tutor reads the README,
          languages and structure.
        </div>
      )}

      {hasResults && !loading && (
        <div className="mt-6">
          <div
            role="tablist"
            aria-label="Project tutor sections"
            className="mb-4 inline-flex rounded-lg border border-[var(--border)] bg-[var(--card)] p-0.5"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === id
                    ? "bg-[var(--control)] text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {activeTab === "analysis" && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              {analysis ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--card-foreground)]">
                  {analysis}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">
                  No overview was generated for this repository.
                </p>
              )}
            </div>
          )}

          {activeTab === "questions" && (
            <div className="grid gap-4">
              {questions ? (
                LEVELS.map(({ id, label, dot }) => (
                  <section
                    key={id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
                  >
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                      <span
                        className={cn("h-2 w-2 rounded-full", dot)}
                        aria-hidden="true"
                      />
                      {label}
                    </h2>
                    <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[var(--card-foreground)]">
                      {(questions[id] ?? []).map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ol>
                  </section>
                ))
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">
                  No questions were generated for this repository.
                </p>
              )}
            </div>
          )}

          {activeTab === "chat" && (
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <div
                className="flex h-[360px] flex-col gap-3 overflow-y-auto p-4"
                aria-live="polite"
              >
                {chatHistory.length === 0 && (
                  <p className="m-auto max-w-sm text-center text-sm text-[var(--muted-foreground)]">
                    Ask about design decisions, trade-offs or how a part of the
                    project works.
                  </p>
                )}
                {chatHistory.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                          : "bg-[var(--control)] text-[var(--foreground)]"
                      )}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="w-fit rounded-lg bg-[var(--control)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                    Thinking…
                  </div>
                )}
              </div>
              <form
                className="flex gap-2 border-t border-[var(--border)] p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleChat();
                }}
              >
                <label htmlFor="tutor-question" className="sr-only">
                  Your question
                </label>
                <input
                  id="tutor-question"
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about this project…"
                  className={inputClass}
                />
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Send"
                  disabled={chatLoading || !chatInput.trim()}
                >
                  <Send aria-hidden="true" />
                </Button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
