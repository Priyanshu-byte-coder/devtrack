"use client";

import { useCallback, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, Sparkles, Moon, Sunrise, Clock, Zap, Users } from "lucide-react";
import type { PersonalityReport } from "@/lib/personality-analysis";

interface Props {
    report: PersonalityReport;
    username: string;
}

const WORKING_STYLE_ICON: Record<string, typeof Moon> = {
    "Night Owl": Moon,
    "Early Bird": Sunrise,
    "9-to-5 Developer": Clock,
};

/** Beautiful, shareable archetype card with a one-click PNG download. */
export default function PersonalityCard({ report, username }: Props) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);

    const handleDownload = useCallback(async () => {
        if (!cardRef.current) return;
        try {
            setDownloading(true);
            const dataUrl = await toPng(cardRef.current, {
                cacheBust: true,
                pixelRatio: 2,
                style: { margin: "0" },
            });
            const link = document.createElement("a");
            link.download = `devtrack-personality-${username}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error("[PersonalityCard] Failed to generate image:", err);
        } finally {
            setDownloading(false);
        }
    }, [username]);

    const WorkingStyleIcon = WORKING_STYLE_ICON[report.workingStyle] ?? Clock;

    return (
        <div className="space-y-4">
            <div
                ref={cardRef}
                className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 md:p-10 shadow-xl"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-transparent pointer-events-none" />

                <div className="relative z-10 space-y-6">
                    <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                            <Sparkles size={12} />
                            Code Personality Report
                        </span>
                        <span className="text-xs font-medium text-[var(--muted-foreground)]">
                            devtrack.app/u/{username}
                        </span>
                    </div>

                    <div>
                        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--card-foreground)]">
                            {report.archetype}
                        </h2>
                        <p className="mt-2 text-base text-[var(--muted-foreground)]">{report.tagline}</p>
                    </div>

                    <p className="text-sm leading-relaxed text-[var(--card-foreground)]/90">
                        {report.description}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <TraitBox icon={WorkingStyleIcon} label="Working Style" value={report.workingStyle} />
                        <TraitBox icon={Zap} label="Commit Pattern" value={report.commitPattern} />
                        <TraitBox icon={Users} label="Collaboration" value={report.collaborationStyle} />
                    </div>

                    {report.strengths.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {report.strengths.map((s) => (
                                <span
                                    key={s}
                                    className="rounded-full bg-[var(--control)] px-3 py-1 text-xs font-medium text-[var(--card-foreground)]"
                                >
                                    {s}
                                </span>
                            ))}
                        </div>
                    )}

                    {report.funFact && (
                        <p className="rounded-xl border border-[var(--border)] bg-[var(--card-muted,var(--control))] px-4 py-3 text-xs text-[var(--muted-foreground)] italic">
                            {report.funFact}
                        </p>
                    )}
                </div>
            </div>

            <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                aria-label="Download personality card as PNG"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--card-foreground)] hover:bg-[var(--control)] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
                {downloading ? (
                    <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Generating…
                    </>
                ) : (
                    <>
                        <Download size={16} />
                        Download as PNG
                    </>
                )}
            </button>
        </div>
    );
}

function TraitBox({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof Moon;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--control)]/40 px-4 py-3">
            <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                <Icon size={14} />
                <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
            </div>
            <div className="mt-1 text-sm font-semibold text-[var(--card-foreground)]">{value}</div>
        </div>
    );
}