"use client";

import React, { useState } from "react";
import { Braces, Check, Copy, FileCode, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResumeContent, ExportFormat } from "@/types/cv-types";

interface ExportPanelProps {
  content: ResumeContent;
  onExport: (format: ExportFormat) => Promise<void>;
  disabled?: boolean;
}

function resumeAsText(content: ResumeContent): string {
  const name = content.profile?.name || content.profile?.login || "";
  const sections = [
    [name, content.role].filter(Boolean).join("\n"),
    `SUMMARY\n${content.professionalSummary}`,
    content.skills.length
      ? `TECHNICAL SKILLS\n${content.skills.map((c) => `${c.category}: ${c.skills.join(", ")}`).join("\n")}`
      : "",
    content.bulletPoints.length
      ? `KEY CONTRIBUTIONS\n${content.bulletPoints.map((bp) => `- ${bp.text}`).join("\n")}`
      : "",
    content.projectDescriptions.length
      ? `PROJECTS\n${content.projectDescriptions
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
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    setExportingFormat(format);
    try {
      await onExport(format);
    } finally {
      setExportingFormat(null);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(resumeAsText(content));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy resume content:", err);
    }
  };

  const busy = disabled || exportingFormat !== null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => handleExport("pdf")} disabled={busy}>
        <FileDown aria-hidden="true" />
        {exportingFormat === "pdf" ? "Preparing PDF…" : "Download PDF"}
      </Button>
      <Button
        variant="outline"
        onClick={() => handleExport("markdown")}
        disabled={busy}
      >
        <FileCode aria-hidden="true" />
        Markdown
      </Button>
      <Button
        variant="outline"
        onClick={() => handleExport("json")}
        disabled={busy}
      >
        <Braces aria-hidden="true" />
        JSON
      </Button>
      <Button variant="ghost" onClick={copyToClipboard}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? "Copied" : "Copy as text"}
      </Button>
      <span className="text-xs text-[var(--muted-foreground)]">
        Edits you make below are included in the download.
      </span>
    </div>
  );
}
