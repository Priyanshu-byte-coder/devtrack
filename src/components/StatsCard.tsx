"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { LucideIcon } from "lucide-react";
import { Flame, Trophy, Zap, Package, Download } from "lucide-react";

interface StatsCardProps {
  username: string;
  avatarUrl: string;
  currentStreak: number;
  longestStreak: number;
  totalCommits: number;
  topRepo: string;
}

/** Renders a 1200×630 OG-style stats card and triggers a PNG download. */
export default function StatsCard({
  username,
  avatarUrl,
  currentStreak,
  longestStreak,
  totalCommits,
  topRepo,
}: StatsCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  async function handleDownload() {
    if (!cardRef.current) return;
    setGenerating(true);

    try {
      const dataUrl = await toPng(cardRef.current, {
        width: 1200,
        height: 630,
        pixelRatio: 2,
        style: {
          // Make sure the off-screen card renders with correct dimensions
          transform: "none",
        },
      });

      const link = document.createElement("a");
      link.download = `devtrack-${username}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("[StatsCard] Failed to generate image:", err);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      {/* ── Download button ───────────────────────────────────────── */}
      <button
        onClick={handleDownload}
        disabled={generating}
        id="download-stats-card-btn"
        aria-label="Download stats card as PNG"
        className="secondary-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
      >
        {generating ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Generating…
          </>
        ) : (
          <>
            <Download size={16} />
            Download stats card
          </>
        )}
      </button>

      {/* ── Off-screen card (1200×630) ────────────────────────────── */}
      {/*
        Positioned absolutely off-screen so it doesn't affect page layout
        but is still rendered in the DOM for html-to-image to capture.
      */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: 1200,
          height: 630,
          overflow: "hidden",
        }}
      >
        <div
          ref={cardRef}
          style={{
            width: 1200,
            height: 630,
            background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 50%, #f8fafc 100%)",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            display: "flex",
            flexDirection: "column",
            padding: "56px 64px",
            boxSizing: "border-box",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Background accent glow */}
          <div
            style={{
              position: "absolute",
              top: -120,
              right: -120,
              width: 480,
              height: 480,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -80,
              left: -60,
              width: 320,
              height: 320,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(96,165,250,0.16) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          {/* ── Header: avatar + username + branding ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 48,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {/* Avatar */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img loading="lazy"
                src={avatarUrl}
                alt={username}
                width={80}
                height={80}
                style={{
                  borderRadius: "50%",
                  border: "3px solid rgba(59,130,246,0.45)",
                  display: "block",
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 800,
                    color: "#111827",
                    lineHeight: 1.1,
                    letterSpacing: "-0.5px",
                  }}
                >
                  @{username}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    color: "#4b5563",
                    marginTop: 4,
                  }}
                >
                  GitHub Developer Stats
                </div>
              </div>
            </div>

            {/* DevTrack branding */}
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#3b82f6",
                letterSpacing: "0.5px",
                opacity: 0.9,
              }}
            >
              devtrack.app
            </div>
          </div>

          {/* ── Stats grid ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 20,
              flex: 1,
            }}
          >
            {/* Current Streak */}
            <StatBox
              icon={Flame}
              label="Current Streak"
              value={String(currentStreak)}
              unit="days"
              accent
            />
            {/* Longest Streak */}
            <StatBox
              icon={Trophy}
              label="Longest Streak"
              value={String(longestStreak)}
              unit="days"
            />
            {/* Total Commits */}
            <StatBox
              icon={Zap}
              label="Total Commits"
              value={totalCommits >= 1000 ? `${(totalCommits / 1000).toFixed(1)}k` : String(totalCommits)}
              unit="commits"
            />
            {/* Top Repo */}
            <StatBox
              icon={Package}
              label="Top Repository"
              value={topRepo.split("/")[1] ?? topRepo}
              unit=""
              small
            />
          </div>

          {/* ── Footer ── */}
          <div
            style={{
              marginTop: 32,
              paddingTop: 20,
              borderTop: "1px solid rgba(148,163,184,0.28)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: 13, color: "#4b5563" }}>
              Generated by DevTrack · devtrack.app/u/{username}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#1d4ed8",
                background: "rgba(96,165,250,0.2)",
                border: "1px solid rgba(59,130,246,0.28)",
                borderRadius: 6,
                padding: "4px 12px",
              }}
            >
              #OpenSource
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Individual stat box inside the card */
function StatBox({
  icon: Icon,
  label,
  value,
  unit,
  accent = false,
  small = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div
      style={{
        background: accent
          ? "linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(96,165,250,0.09) 100%)"
          : "rgba(255,255,255,0.72)",
        border: accent
          ? "1px solid rgba(59,130,246,0.4)"
          : "1px solid rgba(203,213,225,0.8)",
        borderRadius: 16,
        padding: "24px 20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ lineHeight: 1 }}>
        <Icon size={28} strokeWidth={1.5} className={accent ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"} />
      </div>
      <div>
        <div
          style={{
            fontSize: small ? 22 : 40,
            fontWeight: 800,
            color: accent ? "#1d4ed8" : "#111827",
            lineHeight: 1.1,
            marginTop: 12,
            wordBreak: "break-word",
          }}
        >
          {value || "—"}
        </div>
        {unit && (
          <div
            style={{
              fontSize: 13,
              color: "#4b5563",
              marginTop: 4,
            }}
          >
            {unit}
          </div>
        )}
        <div
          style={{
            fontSize: 13,
            color: "#4b5563",
            marginTop: 8,
            fontWeight: 500,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
