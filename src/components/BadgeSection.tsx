"use client";

import React, { useState, useEffect, useRef } from "react";

interface BadgeSectionProps {
  username: string;
}

/**
 * Badge section component for embedding badges in README
 */
export default function BadgeSection({ username }: BadgeSectionProps) {
  // Relative URLs for preview images — always correct regardless of env vars
  const encodedUsername = encodeURIComponent(username);
  const streakBadgePreviewUrl = `/api/badge/streak-shield?user=${encodedUsername}`;
  const commitsBadgePreviewUrl = `/api/badge/commits?user=${encodedUsername}`;

  // Absolute URLs for copy markdown — resolved on client only to avoid hydration mismatch
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const streakBadgeUrl = baseUrl
    ? `${baseUrl}/api/badge/streak-shield?user=${encodedUsername}`
    : streakBadgePreviewUrl;
  const commitsBadgeUrl = baseUrl
    ? `${baseUrl}/api/badge/commits?user=${encodedUsername}`
    : commitsBadgePreviewUrl;

  // Every badge links back to the profile; a bare image in a README sends
  // nobody anywhere. UTM tags show which badge brought people in.
  const profileLink = (badge: string) =>
    `${baseUrl || ""}/u/${encodedUsername.toLowerCase()}?utm_source=github&utm_medium=readme&utm_campaign=${badge}`;
  const linked = (alt: string, image: string, badge: string) =>
    `[![${alt}](${image})](${profileLink(badge)})`;

  const [board, setBoard] = useState<"all" | "month" | "week">("all");
  const rankQuery = `user=${encodedUsername}${board === "all" ? "" : `&board=${board}`}`;
  const rankBadgePreviewUrl = `/api/badge/rank?${rankQuery}`;
  const rankBadgeUrl = baseUrl
    ? `${baseUrl}${rankBadgePreviewUrl}`
    : rankBadgePreviewUrl;
  const rankMarkdown = linked("DevTrack rank", rankBadgeUrl, "rank-badge");

  const streakMarkdown = linked(
    "DevTrack Streak",
    streakBadgeUrl,
    "streak-badge"
  );
  const commitsMarkdown = linked(
    "DevTrack Commits",
    commitsBadgeUrl,
    "commits-badge"
  );
  const combinedMarkdown = `${streakMarkdown} ${commitsMarkdown}`;
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = () => {
    setToastVisible(true);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
      toastTimerRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        id="readme-badges"
        className="scroll-mt-24 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"
      >
        <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">
          Show it off on GitHub
        </h2>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          Paste a badge into your GitHub profile README. It updates daily and
          links back to this profile.
        </p>

        <div className="space-y-4">
          {/* Rank badge: the headline one */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-[var(--card-foreground)]">
                Rank badge
              </h3>
              <div
                role="group"
                aria-label="Which board the badge shows"
                className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--control)] p-0.5 text-xs"
              >
                {(
                  [
                    ["all", "Global"],
                    ["month", "Season"],
                    ["week", "This week"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={board === value}
                    onClick={() => setBoard(value)}
                    className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                      board === value
                        ? "bg-[var(--card)] text-[var(--card-foreground)] shadow-sm"
                        : "text-[var(--muted-foreground)] hover:text-[var(--card-foreground)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-2 overflow-x-auto">
              {/* eslint-disable-next-line @next/next/no-img-element -- live SVG, its size depends on the content */}
              <img
                src={rankBadgePreviewUrl}
                alt="Your DevTrack rank badge"
                height={64}
                className="h-16 w-auto max-w-none"
              />
            </div>
            <CopyableCodeBlock code={rankMarkdown} onCopySuccess={showToast} />
          </div>

          {/* Streak Badge */}
          <div>
            <h3 className="mb-2 font-medium text-[var(--card-foreground)] text-sm">
              Streak Badge
            </h3>
            <div className="mb-2 overflow-x-auto">
              {/* eslint-disable-next-line @next/next/no-img-element -- live SVG, its size depends on the content */}
              <img
                src={streakBadgePreviewUrl}
                alt="DevTrack Streak"
                height={64}
                className="h-16 w-auto max-w-none"
              />
            </div>
            <CopyableCodeBlock
              code={streakMarkdown}
              onCopySuccess={showToast}
            />
          </div>

          {/* Commits Badge */}
          <div>
            <h3 className="mb-2 font-medium text-[var(--card-foreground)] text-sm">
              Commits Badge
            </h3>
            <div className="mb-2 overflow-x-auto">
              {/* eslint-disable-next-line @next/next/no-img-element -- live SVG, its size depends on the content */}
              <img
                src={commitsBadgePreviewUrl}
                alt="DevTrack Commits"
                height={64}
                className="h-16 w-auto max-w-none"
              />
            </div>
            <CopyableCodeBlock
              code={commitsMarkdown}
              onCopySuccess={showToast}
            />
          </div>

          {/* Combined */}
          <div>
            <h3 className="mb-2 font-medium text-[var(--card-foreground)] text-sm">
              Combined (Both Badges)
            </h3>
            <div className="mb-2 flex flex-wrap gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- live SVG, its size depends on the content */}
              <img
                src={streakBadgePreviewUrl}
                alt="DevTrack Streak"
                height={64}
                className="h-16 w-auto max-w-none"
              />
              {/* eslint-disable-next-line @next/next/no-img-element -- live SVG, its size depends on the content */}
              <img
                src={commitsBadgePreviewUrl}
                alt="DevTrack Commits"
                height={64}
                className="h-16 w-auto max-w-none"
              />
            </div>
            <CopyableCodeBlock
              code={combinedMarkdown}
              onCopySuccess={showToast}
            />
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/20">
          <p className="text-xs text-[var(--card-foreground)]">
            <span className="font-semibold">💡 Tip:</span> Badges are cached for
            1 hour and update automatically. Public data only (no authentication
            needed).
          </p>
        </div>
      </div>

      <Toast visible={toastVisible} />
    </>
  );
}

function Toast({ visible }: { visible: boolean }) {
  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4 z-50"
    >
      <div
        className={`max-w-md rounded-full bg-[var(--foreground)] text-[var(--background)] px-4 py-2 text-sm shadow-lg shadow-black/10 transition-all duration-200 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        Badge markdown copied to clipboard
      </div>
    </div>
  );
}

/**
 * Copyable code block component
 */
function CopyableCodeBlock({
  code,
  onCopySuccess,
}: {
  code: string;
  onCopySuccess?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopySuccess?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg bg-[var(--control)] p-3 border border-[var(--border)]">
      <code className="flex-1 text-xs text-[var(--card-foreground)] overflow-auto scrollbar-thin">
        {code}
      </code>
      <button
        onClick={handleCopy}
        className="ml-2 shrink-0 px-2 py-1 text-xs font-medium rounded bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
      >
        {copied ? "✓ Copied!" : "Copy"}
      </button>
    </div>
  );
}
