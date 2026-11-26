"use client";

import React, { useState } from "react";
import { Braces, FileCode, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CopyFeedback } from "@/components/ui/copy-feedback";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import type { ResumeContent, ExportFormat } from "@/types/cv-types";

interface ExportPanelProps {
  content: ResumeContent;
  onExport: (format: ExportFormat) => Promise<void>;
  disabled?: boolean;
}

function resumeAsText(
  content: ResumeContent,
  t: (key: string) => string
): string {
  const name = content.profile?.name || content.profile?.login || "";
  const sections = [
    [name, content.role].filter(Boolean).join("\n"),
    `${t("export.summaryHeading")}\n${content.professionalSummary}`,
    content.skills.length
      ? `${t("export.skillsHeading")}\n${content.skills.map((c) => `${c.category}: ${c.skills.join(", ")}`).join("\n")}`
      : "",
    content.bulletPoints.length
      ? `${t("export.contributionsHeading")}\n${content.bulletPoints.map((bp) => `- ${bp.text}`).join("\n")}`
      : "",
    content.projectDescriptions.length
      ? `${t("export.projectsHeading")}\n${content.projectDescriptions
          .map((p) =>
            [
              `${p.name}${p.technologies.length ? ` (${p.technologies.join(", ")})` : ""}`,
              p.description,
              ...p.highlights.map((h) => `- ${h}`),
            ]
              .filter(Boolean)
              .join("\n")
          )
          .join("\n\n")}`
      : "",
  ];
  return sections.filter(Boolean).join("\n\n");
}

export default function ExportPanel({
  content,
  onExport,
  disabled = false,
}: ExportPanelProps) {
  const t = useTranslations("careerIntelligence");
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(
    null
  );
  const { copy, isCopied } = useCopyToClipboard();

  const handleExport = async (format: ExportFormat) => {
    setExportingFormat(format);
    try {
      await onExport(format);
    } finally {
      setExportingFormat(null);
    }
  };

  const copyToClipboard = async () => {
    if (!(await copy(resumeAsText(content, t)))) {
      toast.error(t("errors.copyFailed"));
    }
  };

  const busy = disabled || exportingFormat !== null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => handleExport("pdf")} disabled={busy}>
        <FileDown aria-hidden="true" />
        {exportingFormat === "pdf"
          ? t("export.preparingPdf")
          : t("export.downloadPdf")}
      </Button>
      <Button
        variant="outline"
        onClick={() => handleExport("markdown")}
        disabled={busy}
      >
        <FileCode aria-hidden="true" />
        {t("export.markdown")}
      </Button>
      <Button
        variant="outline"
        onClick={() => handleExport("json")}
        disabled={busy}
      >
        <Braces aria-hidden="true" />
        {t("export.json")}
      </Button>
      <Button variant="ghost" onClick={copyToClipboard}>
        <CopyFeedback copied={isCopied()} label={t("export.copyAsText")} />
      </Button>
      <span className="text-xs text-[var(--muted-foreground)]">
        {t("export.note")}
      </span>
    </div>
  );
}
