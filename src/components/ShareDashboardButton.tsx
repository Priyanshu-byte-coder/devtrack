"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { getProfileUrl } from "@/lib/profile-url";

async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function ShareDashboardButton() {
  const { data: session, status } = useSession();
  const [copied, setCopied] = useState(false);

  const githubLogin = session?.githubLogin;
  const isLoading = status === "loading";
  const disabled = isLoading || !githubLogin;

  const handleShare = async () => {
    if (!githubLogin) return;

    const profileUrl = getProfileUrl(githubLogin, window.location.origin);
    const ok = await copyToClipboard(profileUrl);

    if (!ok) {
      toast.error("Failed to copy link.");
      return;
    }

    setCopied(true);
    toast.success("Public profile link copied!", { duration: 2000 });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={disabled}
      aria-label="Share dashboard — copy public profile link"
      title="Copy your public profile link"
      className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)]/60 px-5 py-2.5 text-sm font-medium transition-all hover:bg-[var(--card)]/80 hover:shadow-sm hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
    >
      <Share2 className="h-4 w-4" aria-hidden="true" />
      <span>{copied ? "Copied!" : "Share Dashboard"}</span>
    </button>
  );
}
