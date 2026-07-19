"use client";

import { useState } from "react";
import { toast } from "sonner";

interface CopyLinkButtonProps {
  url: string;
}

export default function CopyLinkButton({ url }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // Fallback strategy for older browsers
    if (!navigator.clipboard) {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        triggerSuccess();
      } catch (err) {
        toast.error("Failed to copy link.");
      }
      document.body.removeChild(textArea);
      return;
    }

    // Modern browser copying execution
    try {
      await navigator.clipboard.writeText(url);
      triggerSuccess();
    } catch (err) {
      toast.error("Failed to copy link.");
    }
  };

  const triggerSuccess = () => {
    setCopied(true);
    toast.success("Link copied!", { duration: 2000 });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      aria-label="Copy profile link"
      title="Copy profile link"
      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
    >
      <span>{copied ? "Copied!" : "Copy link"}</span>
    </button>
  );
}