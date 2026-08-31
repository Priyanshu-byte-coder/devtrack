"use client";

import React, { useState } from "react";
import { FileText, FileCode, Braces, Copy, Check, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResumeContent, ExportFormat } from "@/types/cv-types";

interface ExportPanelProps {
  content: ResumeContent;
  onExport: (format: ExportFormat) => Promise<void>;
}

export default function ExportPanel({ content, onExport }: ExportPanelProps) {
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    setExportingFormat(format);
    try {
      await onExport(format);
    } catch (err) {
      console.error(err);
    } finally {
      setExportingFormat(null);
    }
  };

  const copyToClipboard = async () => {
    try {
      const bulletText = content.bulletPoints.map((bp) => `- ${bp.text}`).join("\n");
      const projectText = content.projectDescriptions
        .map((p) => `### ${p.name}\n${p.description}\n${p.highlights.map((h) => `- ${h}`).join("\n")}`)
        .join("\n\n");
      const skillText = content.skills
        .map((c) => `**${c.category}**: ${c.skills.join(", ")}`)
        .join("\n");

      const textToCopy = `
# Resume: ${content.role}

## Professional Summary
${content.professionalSummary}

## Experience Highlights
${bulletText}

## Projects
${projectText}

## Skills Summary
${content.skillSummary}
${skillText}
      `.trim();

      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy resume content:", err);
    }
  };

  const formats = [
    {
      id: "pdf" as ExportFormat,
      name: "PDF Format",
      description: "Download a professionally formatted, ATS-friendly PDF document.",
      icon: FileText,
      colorClass: "text-blue-500",
      accentBg: "hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]",
    },
    {
      id: "markdown" as ExportFormat,
      name: "Markdown",
      description: "Clean Markdown text file suitable for GitHub or personal portfolios.",
      icon: FileCode,
      colorClass: "text-emerald-500",
      accentBg: "hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    },
    {
      id: "json" as ExportFormat,
      name: "JSON Data",
      description: "Raw structured JSON data for programmatic use and APIs.",
      icon: Braces,
      colorClass: "text-purple-500",
      accentBg: "hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {formats.map((f) => {
          const Icon = f.icon;
          const isCurrentExporting = exportingFormat === f.id;

          return (
            <div
              key={f.id}
              className={cn(
                "relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 flex flex-col justify-between transition-all duration-300",
                f.accentBg
              )}
            >
              <div className="space-y-4 mb-6">
                <div className={cn("inline-flex p-3 rounded-lg bg-[var(--card-muted)] border border-[var(--border)]", f.colorClass)}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-lg text-[var(--foreground)]">{f.name}</h4>
                  <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                    {f.description}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={exportingFormat !== null}
                onClick={() => handleExport(f.id)}
                className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors bg-[var(--accent)] text-[var(--accent-foreground)] h-9 px-4 py-2 hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isCurrentExporting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={copyToClipboard}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-muted)] text-[var(--foreground)] h-9 px-5 py-2"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-emerald-500" />
              Copied to Clipboard!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy Full Resume Text
            </>
          )}
        </button>
      </div>
    </div>
  );
}
