"use client";

import { toast } from "sonner";
import { CopyFeedback } from "@/components/ui/copy-feedback";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

interface CopyLinkButtonProps {
  url: string;
}

export default function CopyLinkButton({ url }: CopyLinkButtonProps) {
  const { copy, isCopied } = useCopyToClipboard();

  const handleCopy = async () => {
    if (await copy(url)) {
      toast.success("Link copied!", { duration: 2000 });
    } else {
      toast.error("Failed to copy link.");
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      aria-label="Copy profile link"
      title="Copy profile link"
      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-sm hover:bg-[var(--control)] focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
    >
      <CopyFeedback copied={isCopied()} label="Copy link" />
    </button>
  );
}
