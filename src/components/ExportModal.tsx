"use client";

import { useState } from "react";
import * as htmlToImage from "html-to-image";
import jsPDF from "jspdf";
import { Download, LayoutDashboard, FileImage, FileText, Image as ImageIcon, X } from "lucide-react";

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLegacyExport: (type: "csv" | "pdf" | "json") => Promise<void>;
  reportName: string;
}

export default function ExportModal({ isOpen, onClose, onLegacyExport, reportName }: ExportModalProps) {
  const [activeTab, setActiveTab] = useState<"visual" | "data">("visual");
  const [visualFormat, setVisualFormat] = useState<"png" | "jpeg" | "pdf">("png");
  const [selectedSection, setSelectedSection] = useState<string>("dashboard-content");
  const [themePreference, setThemePreference] = useState<"current" | "light" | "dark">("current");
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const sections = [
    { id: "dashboard-content", name: "Full Dashboard" },
    { id: "streak-tracker", name: "Streak Tracker" },
    { id: "repo-analytics", name: "Repo Analytics" },
    { id: "pr-metrics", name: "PR Metrics" },
    { id: "activity-ring", name: "Activity Ring" },
    { id: "coding-activity-insights", name: "Coding Insights" },
  ];

  const handleVisualExport = async () => {
    setIsExporting(true);
    try {
      const element = document.getElementById(selectedSection);
      if (!element) {
        alert("Selected section not found on the page.");
        return;
      }

      // Small delay to ensure charts (like recharts) have finished animating
      await new Promise((resolve) => setTimeout(resolve, 500));

      const originalTheme = document.documentElement.className;
      // eslint-disable-next-line react-hooks/immutability
      if (themePreference === "light") document.documentElement.className = "light";
      // eslint-disable-next-line react-hooks/immutability
      if (themePreference === "dark") document.documentElement.className = "dark";

      // Re-trigger layout/paint for theme switch
      if (themePreference !== "current") {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const cloneConfig = {
        quality: 1,
        backgroundColor: themePreference === "light" ? "#ffffff" : themePreference === "dark" ? "#0f172a" : undefined,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left"
        }
      };

      if (visualFormat === "pdf") {
        const dataUrl = await htmlToImage.toPng(element, cloneConfig);
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (element.offsetHeight * pdfWidth) / element.offsetWidth;
        
        pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(`devtrack-visual-${reportName}-${new Date().toISOString().slice(0, 10)}.pdf`);
      } else if (visualFormat === "png") {
        const dataUrl = await htmlToImage.toPng(element, cloneConfig);
        downloadUrl(dataUrl, `devtrack-${reportName}.${visualFormat}`);
      } else {
        const dataUrl = await htmlToImage.toJpeg(element, cloneConfig);
        downloadUrl(dataUrl, `devtrack-${reportName}.${visualFormat}`);
      }

      // Restore theme
      if (themePreference !== "current") {
        // eslint-disable-next-line react-hooks/immutability
        document.documentElement.className = originalTheme;
      }
    } catch (error) {
      console.error("Export failed", error);
      alert("Failed to export visual report.");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadUrl = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleLegacy = async (type: "csv" | "pdf" | "json") => {
    setIsExporting(true);
    try {
      await onLegacyExport(type);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Download className="w-5 h-5 text-[var(--accent)]" />
            Export Analytics
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--control)] text-[var(--muted-foreground)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 mb-6 bg-[var(--control)] rounded-lg border border-[var(--border)]">
          <button
            onClick={() => setActiveTab("visual")}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
              activeTab === "visual" ? "bg-[var(--card)] shadow text-[var(--foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            Visual Export
          </button>
          <button
            onClick={() => setActiveTab("data")}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
              activeTab === "data" ? "bg-[var(--card)] shadow text-[var(--foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            Raw Data
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
          
          {activeTab === "visual" ? (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">Select Section</label>
                <div className="grid grid-cols-2 gap-2">
                  {sections.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSection(s.id)}
                      className={`p-3 text-left rounded-lg border text-sm flex items-center gap-2 transition-all ${
                        selectedSection === s.id
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "border-[var(--border)] bg-[var(--control)] text-[var(--card-foreground)] hover:border-[var(--muted-foreground)]"
                      }`}
                    >
                      {s.id === "dashboard-content" ? <LayoutDashboard className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">Theme</label>
                <div className="flex gap-2">
                  {["current", "light", "dark"].map(t => (
                    <button
                      key={t}
                      onClick={() => setThemePreference(t as any)}
                      className={`flex-1 py-2 capitalize text-sm rounded-lg border transition-all ${
                        themePreference === t
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "border-[var(--border)] bg-[var(--control)] text-[var(--card-foreground)] hover:border-[var(--muted-foreground)]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-2">Format</label>
                <div className="flex gap-2">
                  {["png", "jpeg", "pdf"].map(f => (
                    <button
                      key={f}
                      onClick={() => setVisualFormat(f as any)}
                      className={`flex-1 py-2 uppercase text-sm rounded-lg border transition-all font-semibold ${
                        visualFormat === f
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "border-[var(--border)] bg-[var(--control)] text-[var(--card-foreground)] hover:border-[var(--muted-foreground)]"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleVisualExport}
                disabled={isExporting}
                className="w-full mt-4 py-3 rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {isExporting ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4z" />
                    </svg>
                    Generating...
                  </span>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Download Visual Export
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--control)] text-sm text-[var(--muted-foreground)]">
                Download your analytics as raw data or text-based PDF reports for offline analysis or backup.
              </div>
              <div className="grid gap-3">
                <button
                  onClick={() => handleLegacy("csv")}
                  disabled={isExporting}
                  className="w-full p-4 rounded-xl border border-[var(--border)] bg-[var(--control)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all text-left flex items-center gap-4"
                >
                  <div className="p-2 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                    <FileText className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--foreground)]">CSV Spreadsheet</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">Tabular data compatible with Excel/Sheets</p>
                  </div>
                </button>
                <button
                  onClick={() => handleLegacy("json")}
                  disabled={isExporting}
                  className="w-full p-4 rounded-xl border border-[var(--border)] bg-[var(--control)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all text-left flex items-center gap-4"
                >
                  <div className="p-2 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                    <FileText className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--foreground)]">JSON Data</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">Full structured payload for developers</p>
                  </div>
                </button>
                <button
                  onClick={() => handleLegacy("pdf")}
                  disabled={isExporting}
                  className="w-full p-4 rounded-xl border border-[var(--border)] bg-[var(--control)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all text-left flex items-center gap-4"
                >
                  <div className="p-2 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                    <FileText className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--foreground)]">PDF Report (Text)</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">Classic formatted data report</p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
