import { useCallback, useEffect, useRef, useState } from "react";

/** How long a copy button shows its "Copied" state, in milliseconds. */
export const COPY_FEEDBACK_MS = 2000;

const DEFAULT_KEY = "default";

/**
 * Write `text` to the clipboard.
 *
 * Uses the async Clipboard API where the browser offers it. It is missing
 * outside secure contexts (a plain-HTTP preview or LAN address) and in older
 * browsers, so those fall back to copying from a hidden textarea. Rejects when
 * neither works, so callers can tell the user to copy by hand.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is not available");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.opacity = "0";

  // Selecting the textarea moves focus; hand it back to the copy button.
  const previouslyFocused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  document.body.appendChild(textarea);
  try {
    textarea.select();
    // iOS Safari ignores select() on a read-only field without a range.
    textarea.setSelectionRange(0, text.length);
    if (!document.execCommand?.("copy")) {
      throw new Error("Copy command was rejected");
    }
  } finally {
    textarea.remove();
    previouslyFocused?.focus();
  }
}

/**
 * Copy text and show a short-lived "Copied" state, the one way every copy
 * button in DevTrack gives feedback.
 *
 * `copy` resolves to `true` once the text is on the clipboard and to `false`
 * when copying failed, leaving the error message to the caller. A list with
 * several copy buttons passes a `key` per item, so only the clicked one flips
 * to "Copied". Copying again restarts the timer, and it is cleared on unmount.
 */
export function useCopyToClipboard(resetAfterMs: number = COPY_FEEDBACK_MS) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string, key: string = DEFAULT_KEY): Promise<boolean> => {
      try {
        await copyToClipboard(text);
      } catch {
        return false;
      }
      // The write can settle after the component is gone; nothing to show.
      if (!mounted.current) return true;

      if (resetTimer.current) clearTimeout(resetTimer.current);
      setCopiedKey(key);
      resetTimer.current = setTimeout(() => {
        resetTimer.current = null;
        setCopiedKey(null);
      }, resetAfterMs);
      return true;
    },
    [resetAfterMs]
  );

  const isCopied = useCallback(
    (key: string = DEFAULT_KEY) => copiedKey === key,
    [copiedKey]
  );

  return { copy, isCopied };
}
