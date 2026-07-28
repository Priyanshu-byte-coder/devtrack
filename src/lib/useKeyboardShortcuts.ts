import { useEffect } from "react";

export interface ShortcutHandlers {
  onTimeRangeChange?: (days: number) => void;
  onRefresh?: () => void;
  onToggleHelp?: () => void;
  onCloseModal?: () => void;
  onToggleTheme?: () => void;
}

/**
 * Custom hook for keyboard-first navigation in DevTrack.
 * Listens for global keydown events and triggers specified handlers.
 * Ignores keypresses when focus is inside text input, textarea, or editable elements.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement) {
        const tagName = activeElement.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea" || tagName === "select") return;
        if (activeElement.getAttribute("contenteditable") === "true") return;
      }

      // Help modal: ? or Cmd+/ / Ctrl+/
      if (
        (e.key === "?" && !e.altKey) ||
        ((e.metaKey || e.ctrlKey) && e.key === "/")
      ) {
        handlers.onToggleHelp?.();
        e.preventDefault();
        return;
      }

      // Escape -> close modal / panel
      if (e.key === "Escape") {
        handlers.onCloseModal?.();
        e.preventDefault();
        return;
      }

      // Time range shortcuts: 1 -> 7d, 2 -> 14d, 3 -> 30d, 4 -> 90d
      if (e.key === "1") {
        handlers.onTimeRangeChange?.(7);
        e.preventDefault();
        return;
      }
      if (e.key === "2") {
        handlers.onTimeRangeChange?.(14);
        e.preventDefault();
        return;
      }
      if (e.key === "3") {
        handlers.onTimeRangeChange?.(30);
        e.preventDefault();
        return;
      }
      if (e.key === "4") {
        handlers.onTimeRangeChange?.(90);
        e.preventDefault();
        return;
      }

      // R -> refresh data
      if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        handlers.onRefresh?.();
        e.preventDefault();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handlers]);
}
