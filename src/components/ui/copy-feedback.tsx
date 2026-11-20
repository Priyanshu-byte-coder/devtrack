import type { ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyFeedbackProps {
  /** Whether the copy just succeeded (from `useCopyToClipboard`). */
  copied: boolean;
  /** Text shown before copying. Leave out for an icon-only button. */
  label?: ReactNode;
  /** Text shown after copying. */
  copiedLabel?: ReactNode;
  /** Never show text, even after copying, for tight icon buttons. */
  iconOnly?: boolean;
  /** Icon size and the like, e.g. "h-4 w-4". */
  iconClassName?: string;
  /** Colour of the copied state; pass "" where it sits on an accent fill. */
  copiedClassName?: string;
  className?: string;
}

/**
 * Contents of a copy button: a copy icon that turns into a checkmark, with an
 * optional label that reads "Copied!" for a moment after a successful copy.
 * Pair it with `useCopyToClipboard`.
 */
export function CopyFeedback({
  copied,
  label,
  copiedLabel = "Copied!",
  iconOnly = false,
  iconClassName,
  copiedClassName = "text-[var(--success)]",
  className,
}: CopyFeedbackProps) {
  const text = iconOnly ? null : copied ? copiedLabel : label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        copied && copiedClassName,
        className
      )}
    >
      {copied ? (
        <Check
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5 shrink-0 motion-safe:animate-copy-pop",
            iconClassName
          )}
        />
      ) : (
        <Copy
          aria-hidden="true"
          className={cn("h-3.5 w-3.5 shrink-0", iconClassName)}
        />
      )}
      {text != null && text !== "" && <span>{text}</span>}
    </span>
  );
}
