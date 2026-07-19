"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";

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

  const streakMarkdown = `![DevTrack Streak](${streakBadgeUrl})`;
  const commitsMarkdown = `![DevTrack Commits](${commitsBadgeUrl})`;
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
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">
        📌 Get Your Badge
      </h2>
      <p className="mb-4 text-sm text-[var(--muted-foreground)]">
        Show off your DevTrack stats on your GitHub profile! Copy and paste the markdown below into your README.
      </p>

      <div className="space-y-4">
        {/* Streak Badge */}
        <div>
          <h3 className="mb-2 font-medium text-[var(--card-foreground)] text-sm">
            Streak Badge
          </h3>
          <div className="mb-2">
            <Image src={streakBadgePreviewUrl} alt="DevTrack Streak" width={150} height={20} className="w-auto h-auto" unoptimized />
          </div>
          <CopyableCodeBlock code={streakMarkdown} onCopySuccess={showToast} />
        </div>

        {/* Commits Badge */}
        <div>
          <h3 className="mb-2 font-medium text-[var(--card-foreground)] text-sm">
            Commits Badge
          </h3>
          <div className="mb-2">
            <Image src={commitsBadgePreviewUrl} alt="DevTrack Commits" width={150} height={20} className="w-auto h-auto" unoptimized />
          </div>
          <CopyableCodeBlock code={commitsMarkdown} onCopySuccess={showToast} />
        </div>

        {/* Combined */}
        <div>
          <h3 className="mb-2 font-medium text-[var(--card-foreground)] text-sm">
            Combined (Both Badges)
          </h3>
          <div className="mb-2 flex gap-1">
            <Image src={streakBadgePreviewUrl} alt="DevTrack Streak" width={150} height={20} className="w-auto h-auto" unoptimized />
            <Image src={commitsBadgePreviewUrl} alt="DevTrack Commits" width={150} height={20} className="w-auto h-auto" unoptimized />
          </div>
          <CopyableCodeBlock code={combinedMarkdown} onCopySuccess={showToast} />
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20">
        <p className="text-xs text-[var(--card-foreground)]">
          <span className="font-semibold">💡 Tip:</span> Badges are cached for 1 hour and update automatically. Public data only (no authentication needed).
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
function CopyableCodeBlock({ code, onCopySuccess }: { code: string; onCopySuccess?: () => void }) {
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
