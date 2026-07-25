"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Terminal, FileDown, Cpu, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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

export default function CareerIntelligence() {
  const [step, setStep] = useState<CVFlowStep>("idle");
  const [progressValue, setProgressValue] = useState(0);
  const [progressText, setProgressText] = useState("");
  
  const [analysis, setAnalysis] = useState<ContributionClassification | null>(null);
  const [selectedRole, setSelectedRole] = useState<TargetRole | null>(null);
  const [resumeContent, setResumeContent] = useState<ResumeContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Animates the progress bar during analysis
  const startProgressAnimation = () => {
    setProgressValue(0);
    setError(null);
    
    const steps = [
      { max: 25, text: "Connecting to GitHub GraphQL API..." },
      { max: 50, text: "Analyzing repository metadata & branch structures..." },
      { max: 75, text: "Processing merged Pull Requests & line diffs..." },
      { max: 98, text: "Classifying engineering domains & computing expertise..." },
    ];

    let currentStepIdx = 0;
    const interval = setInterval(() => {
      setProgressValue((prev) => {
        const currentStep = steps[currentStepIdx];
        if (!currentStep) return prev;
        
        setProgressText(currentStep.text);

        if (prev >= currentStep.max) {
          if (currentStepIdx < steps.length - 1) {
            currentStepIdx++;
          }
          return prev;
        }
        return prev + 1;
      });
    }, 70);

    return interval;
  };

  const handleAnalyze = async () => {
    setStep("analyzing");
    const interval = startProgressAnimation();

    try {
      const res = await fetch("/api/cv/analyze", {
        method: "POST",
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to analyze contributions");
      }

      const data = await res.json();
      clearInterval(interval);
      setProgressValue(100);
      setProgressText("Analysis complete!");

      setTimeout(() => {
        setAnalysis(data.analysis);
        setStep("analyzed");
        toast.success("GitHub contributions analyzed successfully!");
      }, 500);
    } catch (err: any) {
      clearInterval(interval);
      setStep("idle");
      const errMsg = err?.message || String(err);
      setError(errMsg);
      toast.error(`Analysis failed: ${errMsg}`);
    }
  };

  const handleGenerate = async () => {
    if (!selectedRole) {
      toast.error("Please select or specify a target role first.");
      return;
    }

    setStep("generating");
    setError(null);

    try {
      const res = await fetch("/api/cv/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: selectedRole }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to generate CV content");
      }

      const data = await res.json();
      setResumeContent(data.content);
      setStep("generated");
      toast.success(`Resume generated for ${selectedRole}!`);
    } catch (err: any) {
      setStep("analyzed");
      const errMsg = err?.message || String(err);
      setError(errMsg);
      toast.error(`Generation failed: ${errMsg}`);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!resumeContent) return;

    setStep("exporting");

    try {
      const res = await fetch("/api/cv/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ format, content: resumeContent }),
      });

      if (!res.ok) {
        throw new Error("Failed to export resume file");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      const fileExt = format === "markdown" ? "md" : format;
      const roleSlug = resumeContent.role.toLowerCase().replace(/\s+/g, "_");
      a.download = `DevTrack_Resume_${roleSlug}.${fileExt}`;
      
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Downloaded ${format.toUpperCase()} successfully!`);
    } catch (err) {
      toast.error("Failed to download file. Please try again.");
    } finally {
      setStep("generated");
    }
  };

  return (
    <div className="space-y-12 max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      {/* Hero Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 md:p-12 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/5 to-transparent pointer-events-none" />
        <div className="space-y-4 max-w-2xl relative z-10">
          <Badge variant="outline" className="text-xs px-3 py-1 border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]">
            AI-Powered Career Intelligence
          </Badge>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-[var(--foreground)] to-[var(--foreground)]/70 bg-clip-text text-transparent">
            AI Resume & CV Generator
          </h1>
          <p className="text-sm md:text-base text-[var(--muted-foreground)] leading-relaxed">
            Translate your real GitHub footprint—merged pull requests, code additions/deletions, complexity, and technology patterns—into a professional, ATS-optimized resume tailor-made for your target role.
          </p>
        </div>
        <div className="relative z-10 flex items-center justify-center p-6 rounded-2xl bg-[var(--card-muted)] border border-[var(--border)] shadow-inner">
          <Cpu className="h-16 w-16 text-[var(--accent)] animate-pulse" />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-sm flex gap-3 items-center">
          <span className="font-semibold">Error:</span>
          <span>{error}</span>
        </div>
      )}

      {/* SECTION 1: CONTRIBUTION ANALYSIS */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
          <div className="h-8 w-1.5 rounded-full bg-violet-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]"></div>
          <h2 className="text-2xl font-bold tracking-tight">1. Contribution Analysis</h2>
        </div>

        {step === "idle" && (
          <Card className="border-[var(--border)] bg-[var(--card)] hover:shadow-2xl transition-all duration-300">
            <CardHeader className="text-center py-8 space-y-2">
              <CardTitle className="text-xl font-bold">Discover Your Open-Source Footprint</CardTitle>
              <CardDescription className="max-w-md mx-auto">
                We&apos;ll fetch your top 50 repositories and analyze all your merged Pull Requests to build a complete technology and impact profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-8">
              <button
                type="button"
                onClick={handleAnalyze}
                className="group relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20 px-8 py-3.5 hover:scale-[1.03] transition-all duration-300 active:scale-[0.98]"
              >
                <Sparkles className="h-4.5 w-4.5 animate-spin duration-1000" />
                Analyze My GitHub Footprint
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </CardContent>
          </Card>
        )}

        {step === "analyzing" && (
          <Card className="border-[var(--border)] bg-[var(--card)] p-8">
            <div className="space-y-6 max-w-xl mx-auto py-6">
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-[var(--foreground)]">{progressText}</span>
                <span className="text-violet-400">{progressValue}%</span>
              </div>
              <Progress value={progressValue} color="rgba(168, 85, 247, 1)" />
              <div className="flex justify-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Terminal className="h-4 w-4 animate-pulse" />
                <span>Generating local telemetry nodes...</span>
              </div>
            </div>
          </Card>
        )}

        {analysis && (step !== "idle" && step !== "analyzing") && (
          <div className="space-y-6">
            <ContributionStats scores={analysis.contributionScores} domains={analysis.domains} />
            <ContributionAnalysisPanel analysis={analysis} />
          </div>
        )}
      </section>

      {/* SECTION 2: RESUME GENERATOR */}
      {analysis && (
        <section className="space-y-6 animate-in slide-in-from-bottom duration-500">
          <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
            <div className="h-8 w-1.5 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
            <h2 className="text-2xl font-bold tracking-tight">2. Resume Customization</h2>
          </div>

          <Card className="border-[var(--border)] bg-[var(--card)] p-6 md:p-8 space-y-8">
            <div className="space-y-2">
              <h3 className="text-lg font-bold">Select Target Role</h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                Choose the type of position you are applying for. The resume content will be strategically optimized to match this role&apos;s keywords and domains.
              </p>
            </div>

            <RoleSelector
              selectedRole={selectedRole}
              onRoleSelect={setSelectedRole}
              disabled={step === "generating"}
            />

            {step !== "generated" && step !== "generating" && (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  disabled={!selectedRole}
                  onClick={handleGenerate}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold bg-blue-600 text-white shadow-lg shadow-blue-500/20 px-8 py-3 hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Resume Content
                </button>
              </div>
            )}

            {step === "generating" && (
              <div className="py-12 flex flex-col items-center justify-center gap-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold">Consulting AI Career Mentor...</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Drafting ATS-friendly bullets based on actual PR additions & deletions.</p>
                </div>
              </div>
            )}

            {resumeContent && (step === "generated" || step === "exporting") && (
              <ResumePreview
                content={resumeContent}
                onContentChange={(newContent) => setResumeContent(newContent)}
              />
            )}
          </Card>
        </section>
      )}

      {/* SECTION 3: EXPORT & DOWNLOAD */}
      {resumeContent && (step === "generated" || step === "exporting") && (
        <section className="space-y-6 animate-in slide-in-from-bottom duration-500">
          <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
            <div className="h-8 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
            <h2 className="text-2xl font-bold tracking-tight">3. Export & Download</h2>
          </div>

          <Card className="border-[var(--border)] bg-[var(--card)] p-6 md:p-8">
            <ExportPanel content={resumeContent} onExport={handleExport} />
          </Card>
        </section>
      )}
    </div>
  );
}
