"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Sparkles, ChevronRight, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PersonalityCard from "@/components/PersonalityCard";
import PersonalityRadar from "@/components/PersonalityRadar";
import type { PersonalityReport as PersonalityReportData } from "@/lib/personality-analysis";

type Step = "idle" | "loading" | "ready";

export default function PersonalityReport() {
    const { data: session } = useSession();
    const [step, setStep] = useState<Step>("idle");
    const [report, setReport] = useState<PersonalityReportData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const username = session?.githubLogin ?? "you";

    async function fetchReport(refresh = false) {
        setStep("loading");
        setError(null);

        try {
            const res = await fetch(`/api/personality${refresh ? "?refresh=true" : ""}`);

            if (res.status === 429) {
                const retryAfter = res.headers.get("Retry-After");
                throw new Error(
                    retryAfter
                        ? `Rate limit reached. Try again in ${Math.ceil(Number(retryAfter) / 60)} min.`
                        : "Rate limit reached. Try again later."
                );
            }

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Failed to generate your personality report");
            }

            const json = await res.json();
            setReport(json.data as PersonalityReportData);
            setStep("ready");
            toast.success("Your code personality report is ready!");
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            setStep("idle");
            toast.error(message);
        }
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
            <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 md:p-12 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/5 to-transparent pointer-events-none" />
                <div className="space-y-4 max-w-2xl relative z-10">
                    <Badge
                        variant="outline"
                        className="text-xs px-3 py-1 border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]"
                    >
                        AI-Powered · Discover What Kind of Developer You Are
                    </Badge>
                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-[var(--foreground)] to-[var(--foreground)]/70 bg-clip-text text-transparent">
                        Code Personality Report
                    </h1>
                    <p className="text-sm md:text-base text-[var(--muted-foreground)] leading-relaxed">
                        We&apos;ll analyze your commit times, streak, PR habits, and top repos to reveal your
                        developer archetype — a fun, shareable take on how you actually work.
                    </p>
                </div>
            </div>

            {error && step === "idle" && (
                <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-sm flex gap-3 items-center">
                    <span className="font-semibold">Error:</span>
                    <span>{error}</span>
                </div>
            )}

            {step === "idle" && (
                <Card className="border-[var(--border)] bg-[var(--card)] hover:shadow-2xl transition-all duration-300">
                    <CardHeader className="text-center py-8 space-y-2">
                        <CardTitle className="text-xl font-bold">Discover Your Developer Archetype</CardTitle>
                        <CardDescription className="max-w-md mx-auto">
                            Uses your existing GitHub stats already tracked in DevTrack — no extra setup, no new
                            permissions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center pb-8">
                        <button
                            type="button"
                            onClick={() => fetchReport(false)}
                            className="group relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20 px-8 py-3.5 hover:scale-[1.03] transition-all duration-300 active:scale-[0.98]"
                        >
                            <Sparkles className="h-4.5 w-4.5" />
                            Generate My Personality Report
                            <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </CardContent>
                </Card>
            )}

            {step === "loading" && (
                <Card className="border-[var(--border)] bg-[var(--card)] p-8">
                    <div className="py-12 flex flex-col items-center justify-center gap-4">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
                        <div className="text-center space-y-1">
                            <p className="text-sm font-bold">Analyzing your coding patterns…</p>
                            <p className="text-xs text-[var(--muted-foreground)]">
                                Crunching commit times, PR history, and streaks.
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {step === "ready" && report && (
                <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
                    <PersonalityCard report={report} username={username} />

                    <Card className="border-[var(--border)] bg-[var(--card)] p-6 md:p-8">
                        <h3 className="text-base font-bold mb-1">Your Personality Radar</h3>
                        <p className="text-xs text-[var(--muted-foreground)] mb-4">
                            How your traits compare across five dimensions.
                        </p>
                        <PersonalityRadar report={report} />
                    </Card>

                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={() => fetchReport(true)}
                            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] transition-colors"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Regenerate report
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}