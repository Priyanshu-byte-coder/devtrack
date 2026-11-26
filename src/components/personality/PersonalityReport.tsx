"use client";

import { useState } from "react";
import PageHeader from "@/components/shell/PageHeader";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Sparkles, ChevronRight, RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import PersonalityCard from "@/components/PersonalityCard";
import PersonalityRadar from "@/components/PersonalityRadar";
import type { PersonalityReport as PersonalityReportData } from "@/lib/personality-analysis";

type Step = "idle" | "loading" | "ready";

export default function PersonalityReport() {
  const t = useTranslations("personality");
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>("idle");
  const [report, setReport] = useState<PersonalityReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const username = session?.githubLogin ?? "you";

  async function fetchReport(refresh = false) {
    setStep("loading");
    setError(null);

    try {
      const res = await fetch(
        `/api/personality${refresh ? "?refresh=true" : ""}`
      );

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        throw new Error(
          retryAfter
            ? t("errors.rateLimitWithRetry", {
                minutes: Math.ceil(Number(retryAfter) / 60),
              })
            : t("errors.rateLimit")
        );
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error || t("errors.generateFailed")
        );
      }

      const json = await res.json();
      setReport(json.data as PersonalityReportData);
      setStep("ready");
      toast.success(t("ready.successToast"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStep("idle");
      toast.error(message);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={t("header.title")}
        description={t("header.description")}
      />

      {error && step === "idle" && (
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-sm flex gap-3 items-center">
          <span className="font-semibold">{t("errors.errorPrefix")}</span>
          <span>{error}</span>
        </div>
      )}

      {step === "idle" && (
        <Card className="border-[var(--border)] bg-[var(--card)] hover:shadow-2xl transition-shadow duration-300">
          <CardHeader className="text-center py-8 space-y-2">
            <CardTitle className="text-xl font-bold">
              {t("initial.title")}
            </CardTitle>
            <CardDescription className="max-w-md mx-auto">
              {t("initial.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <button
              type="button"
              onClick={() => fetchReport(false)}
              className="group relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20 px-8 py-3.5 hover:scale-[1.03] transition-transform duration-300 active:scale-[0.98]"
            >
              <Sparkles className="h-4.5 w-4.5" />
              {t("initial.generateButton")}
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
              <p className="text-sm font-bold">
                {t("loading.title")}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("loading.subtitle")}
              </p>
            </div>
          </div>
        </Card>
      )}

      {step === "ready" && report && (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
          <PersonalityCard report={report} username={username} />

          <Card className="border-[var(--border)] bg-[var(--card)] p-6 md:p-8">
            <h3 className="text-base font-bold mb-1">{t("radar.title")}</h3>
            <p className="text-xs text-[var(--muted-foreground)] mb-4">
              {t("radar.description")}
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
              {t("ready.regenerate")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
