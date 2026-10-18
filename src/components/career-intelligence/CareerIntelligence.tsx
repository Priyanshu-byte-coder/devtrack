"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ScanSearch, Sparkles } from "lucide-react";
import PageHeader from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import RoleSelector from "./RoleSelector";
import ContributionAnalysisPanel from "./ContributionAnalysisPanel";
import ContributionStats from "./ContributionStats";
import ResumePreview from "./ResumePreview";
import ExportPanel from "./ExportPanel";

import type {
  CVFlowStep,
  ContributionClassification,
  TargetRole,
  ResumeContent,
  ExportFormat,
} from "@/types/cv-types";

const ANALYSIS_STEPS = [
  { until: 25, text: "Fetching your repositories…" },
  { until: 55, text: "Reading merged pull requests…" },
  { until: 80, text: "Detecting languages and frameworks…" },
  { until: 97, text: "Scoring engineering domains…" },
];

/** Turns an API error body ({ error }) or plain text into a readable message. */
async function readError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    if (
      typeof parsed.error === "string" &&
      parsed.error !== "GITHUB_RATE_LIMITED"
    ) {
      return parsed.error;
    }
    if (parsed.error === "GITHUB_RATE_LIMITED") {
      return "GitHub's rate limit was reached. Try again in a few minutes.";
    }
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // not JSON
  }
  if (res.status === 401) return "Your session expired. Sign in again.";
  return fallback;
}

function filenameFrom(res: Response, fallback: string): string {
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  return match?.[1] ?? fallback;
}

function StepHeading({
  n,
  title,
  done,
}: {
  n: number;
  title: string;
  done?: boolean;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
          done
            ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
            : "border border-[var(--border)] text-[var(--muted-foreground)]"
        }`}
        aria-hidden="true"
      >
        {n}
      </span>
      {title}
    </h2>
  );
}

export default function CareerIntelligence() {
  const [step, setStep] = useState<CVFlowStep>("idle");
  const [restoring, setRestoring] = useState(true);
  const [progressValue, setProgressValue] = useState(0);
  const [progressText, setProgressText] = useState(ANALYSIS_STEPS[0].text);
  const [analysis, setAnalysis] = useState<ContributionClassification | null>(
    null
  );
  const [selectedRole, setSelectedRole] = useState<TargetRole | null>(null);
  const [resumeContent, setResumeContent] = useState<ResumeContent | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pick up a cached analysis (24 h) so returning users skip step 1.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/cv/analyze", { cache: "no-store" })
      .then(async (res) =>
        res.ok
          ? ((await res.json()) as { analysis?: ContributionClassification })
          : null
      )
      .then((data) => {
        if (cancelled || !data?.analysis) return;
        setAnalysis(data.analysis);
        setStep("analyzed");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  const startProgress = () => {
    setProgressValue(0);
    setProgressText(ANALYSIS_STEPS[0].text);
    let value = 0;
    progressTimer.current = setInterval(() => {
      const current = ANALYSIS_STEPS.find((s) => value < s.until);
      if (!current) return;
      value += 1;
      setProgressValue(value);
      setProgressText(current.text);
    }, 120);
  };

  const stopProgress = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = null;
  };

  const handleAnalyze = async () => {
    setStep("analyzing");
    setError(null);
    startProgress();

    try {
      const res = await fetch("/api/cv/analyze", { method: "POST" });
      if (!res.ok) {
        throw new Error(
          await readError(res, "Could not analyze your GitHub activity.")
        );
      }
      const data = (await res.json()) as {
        analysis: ContributionClassification;
      };
      stopProgress();
      setProgressValue(100);
      setAnalysis(data.analysis);
      setStep("analyzed");
    } catch (err) {
      stopProgress();
      setStep("idle");
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    }
  };

  const handleGenerate = async (regenerate = false) => {
    if (!selectedRole) {
      toast.error("Pick a target role first.");
      return;
    }

    setStep("generating");
    setError(null);

    try {
      const res = await fetch("/api/cv/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole, regenerate, analysis }),
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Could not generate the resume."));
      }
      const data = (await res.json()) as { content: ResumeContent };
      setResumeContent(data.content);
      setStep("generated");
      requestAnimationFrame(() =>
        document
          .getElementById("resume-preview")
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    } catch (err) {
      setStep(resumeContent ? "generated" : "analyzed");
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!resumeContent) return;
    setStep("exporting");

    try {
      const res = await fetch("/api/cv/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, content: resumeContent }),
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Could not export the resume."));
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFrom(
        res,
        `resume.${format === "markdown" ? "md" : format}`
      );
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to download file."
      );
    } finally {
      setStep("generated");
    }
  };

  const hasResume =
    Boolean(resumeContent) && (step === "generated" || step === "exporting");
  const busy = step === "analyzing" || step === "generating";

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Resume"
        description="Turn your GitHub work into an ATS-friendly resume tailored to a role."
        actions={
          analysis && !busy ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAnalyze}
              title="Analyses are cached for 24 hours"
            >
              <ScanSearch aria-hidden="true" />
              Re-scan GitHub
            </Button>
          ) : null
        }
      />

      {error && (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-[var(--destructive-muted-border)] bg-[var(--destructive-muted)] px-3 py-2 text-sm text-[var(--destructive)]"
        >
          {error}
        </p>
      )}

      <div className="space-y-8">
        {/* 1. Analysis */}
        <section aria-labelledby="resume-step-1">
          <div id="resume-step-1">
            <StepHeading
              n={1}
              title="Your GitHub footprint"
              done={Boolean(analysis)}
            />
          </div>

          {restoring ? (
            <div
              className="h-28 animate-pulse rounded-xl bg-[var(--card-muted)]"
              aria-busy="true"
            />
          ) : step === "analyzing" ? (
            <div
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
              aria-live="polite"
            >
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-[var(--foreground)]">{progressText}</span>
                <span className="tabular-nums text-[var(--muted-foreground)]">
                  {progressValue}%
                </span>
              </div>
              <Progress value={progressValue} />
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                Usually 20–60 seconds, depending on how many repositories you
                have.
              </p>
            </div>
          ) : analysis ? (
            <div className="space-y-4">
              <ContributionStats
                scores={analysis.contributionScores}
                domains={analysis.domains}
              />
              <ContributionAnalysisPanel analysis={analysis} />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <div className="max-w-xl">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Scan your repositories and merged pull requests
                </p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  DevTrack reads up to 50 repositories to work out your
                  languages, frameworks and impact. Nothing is posted to GitHub.
                </p>
              </div>
              <Button onClick={handleAnalyze}>
                <ScanSearch aria-hidden="true" />
                Analyze GitHub activity
              </Button>
            </div>
          )}
        </section>

        {/* 2. Role + generate */}
        {analysis && step !== "analyzing" && (
          <section aria-labelledby="resume-step-2">
            <div id="resume-step-2">
              <StepHeading n={2} title="Target role" done={hasResume} />
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
              <p className="mb-4 text-sm text-[var(--muted-foreground)]">
                Wording, skills and projects are picked to match the role you
                choose.
              </p>
              <RoleSelector
                selectedRole={selectedRole}
                onRoleSelect={setSelectedRole}
                disabled={step === "generating"}
              />
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button
                  disabled={!selectedRole || step === "generating"}
                  onClick={() => handleGenerate(false)}
                >
                  <Sparkles aria-hidden="true" />
                  {step === "generating"
                    ? "Writing your resume…"
                    : "Generate resume"}
                </Button>
                {hasResume && resumeContent?.role === selectedRole && (
                  <Button
                    variant="outline"
                    onClick={() => handleGenerate(true)}
                  >
                    <RefreshCw aria-hidden="true" />
                    Regenerate
                  </Button>
                )}
                {step === "generating" && (
                  <span
                    className="text-xs text-[var(--muted-foreground)]"
                    aria-live="polite"
                  >
                    Drafting each section from your real contribution data…
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 3. Preview + export */}
        {hasResume && resumeContent && (
          <section
            aria-labelledby="resume-step-3"
            id="resume-preview"
            className="scroll-mt-20"
          >
            <div
              id="resume-step-3"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <StepHeading n={3} title="Review and download" />
            </div>
            <div className="mb-4">
              <ExportPanel
                content={resumeContent}
                onExport={handleExport}
                disabled={step === "exporting"}
              />
            </div>
            <ResumePreview
              content={resumeContent}
              onContentChange={setResumeContent}
            />
          </section>
        )}
      </div>
    </div>
  );
}
