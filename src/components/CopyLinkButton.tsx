"use client";

import { CopyButton } from "@/components/ui/CopyButton";

interface CopyLinkButtonProps {
  url: string;
  className?: string;
}

export default function CopyLinkButton({ url, className }: CopyLinkButtonProps) {
  return (
    <CopyButton
      value={url}
      copyLabel="Copy link"
      copiedLabel="Link Copied!"
      toastMessage="Profile link copied to clipboard!"
      className={className}
    />
  );
}