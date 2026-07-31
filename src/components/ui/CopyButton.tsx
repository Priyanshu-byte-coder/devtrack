"use client";

import * as React from "react";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface CopyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  copyLabel?: string;
  copiedLabel?: string;
  toastMessage?: string;
  showToast?: boolean;
  showText?: boolean;
  iconOnly?: boolean;
  duration?: number;
  onCopySuccess?: () => void;
}

export const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      value,
      copyLabel = "Copy",
      copiedLabel = "Copied!",
      toastMessage,
      showToast = true,
      showText = true,
      iconOnly = false,
      duration = 2500,
      onCopySuccess,
      className,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (onClick) onClick(e);
      if (!value) return;

      let success = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(value);
          success = true;
        } catch (err) {
          console.error("Clipboard write error:", err);
        }
      }

      if (!success) {
        try {
          const textArea = document.createElement("textarea");
          textArea.value = value;
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";
          document.body.appendChild(textArea);
          textArea.select();
          success = document.execCommand("copy");
          document.body.removeChild(textArea);
        } catch (err) {
          console.error("ExecCommand copy error:", err);
        }
      }

      if (success) {
        setCopied(true);
        if (showToast) {
          toast.success(toastMessage || "Copied to clipboard!", { duration });
        }
        if (onCopySuccess) {
          onCopySuccess();
        }
        setTimeout(() => {
          setCopied(false);
        }, duration);
      } else {
        toast.error("Failed to copy to clipboard.");
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleCopy}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 active:scale-95 disabled:opacity-50 disabled:pointer-events-none select-none",
          copied
            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40 shadow-sm"
            : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 shadow-sm",
          className
        )}
        title={copied ? copiedLabel : copyLabel}
        aria-label={copied ? copiedLabel : copyLabel}
        {...props}
      >
        <span className="relative flex items-center justify-center w-3.5 h-3.5 flex-shrink-0">
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-in zoom-in-50 duration-200" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-current transition-transform duration-150 group-hover:scale-110" />
          )}
        </span>
        {children ? (
          children
        ) : !iconOnly && showText ? (
          <span className={cn("transition-opacity duration-150", copied && "font-semibold")}>
            {copied ? copiedLabel : copyLabel}
          </span>
        ) : null}
      </button>
    );
  }
);

CopyButton.displayName = "CopyButton";
