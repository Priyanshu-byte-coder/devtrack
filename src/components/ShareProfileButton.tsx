"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ShareStats {
  streak: number | null;
  mergeRate: number | null;
  goalPercent: number | null;
}

interface ShareProfileButtonProps {
  githubLogin: string;
  stats?: ShareStats;
}

export default function ShareProfileButton({
  githubLogin,
  stats,
}: ShareProfileButtonProps) {
  const [copied, setCopied] = useState(false);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://devtrack-silk-kappa.vercel.app";
  const profileUrl = `${baseUrl}/u/${githubLogin}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const buildTweetText = () => {
    const lines = ["🔥 My DevTrack stats:"];
    if (stats?.streak !== null && stats?.streak !== undefined)
      lines.push(`📈 ${stats.streak} day streak`);
    if (stats?.mergeRate !== null && stats?.mergeRate !== undefined)
      lines.push(`✅ ${stats.mergeRate}% merge rate`);
    if (stats?.goalPercent !== null && stats?.goalPercent !== undefined)
      lines.push(`🎯 Weekly goal ${stats.goalPercent}% complete`);
    lines.push("Track your own coding pulse 👇");
    lines.push(profileUrl);
    lines.push("#GitHub #DevTrack #GSSoC");
    return lines.join("\n");
  };

  const handleTwitterShare = () => {
    const tweet = encodeURIComponent(buildTweetText());
    window.open(`https://twitter.com/intent/tweet?text=${tweet}`, "_blank");
  };

  const handleLinkedInShare = () => {
    const url = encodeURIComponent(profileUrl);
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      "_blank"
    );
  };

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleCopy} title="Copy your profile link">
        {copied ? (
          <>
            <Check className="mr-2 h-4 w-4" />
            Copied
          </>
        ) : (
          <>
            <Link2 className="mr-2 h-4 w-4" />
            Share Profile
          </>
        )}
      </Button>

      <button
        type="button"
        onClick={handleTwitterShare}
        title="Share on X (Twitter)"
        className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-black px-3 py-2 text-sm font-medium text-white transition-all hover:bg-zinc-800 active:scale-95"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.261 5.632 5.903-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={handleLinkedInShare}
        title="Share on LinkedIn"
        className="flex items-center justify-center gap-2 rounded-lg border border-[#0A66C2]/50 bg-[#0A66C2] px-3 py-2 text-sm font-medium text-white transition-all hover:bg-[#0958a8] active:scale-95"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 23.2 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      </button>
    </div>
  );
}