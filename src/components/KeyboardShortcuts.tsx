"use client";

import { useState, useRef, useEffect } from "react";

import { useTheme } from "@/components/ThemeContext";
import ShortcutsModal from "@/components/ShortcutsModal";

export default function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  const [announcement, setAnnouncement] = useState("");
  const { theme, themeDefinition, toggleTheme } = useTheme();
  const keyboardToggleRef = useRef(false);
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (keyboardToggleRef.current && theme !== undefined) {
      setAnnouncement(`${themeDefinition?.name ?? "Theme"} enabled`);
    }
    keyboardToggleRef.current = false;
  }, [theme, themeDefinition]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement) {
        const tagName = activeElement.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea" || tagName === "select") return;
        if (activeElement.getAttribute("contenteditable") === "true") return;
      }

      if (e.key === "?") {
        setIsOpen(true);
        e.preventDefault();
        return;
      }

      if (e.key.toLowerCase() === "t") {
        keyboardToggleRef.current = true;
        toggleTheme();
        e.preventDefault();
        return;
      }

      if (e.key.toLowerCase() === "b") {
        window.dispatchEvent(new Event("toggleChart"));
        e.preventDefault();
        return;
      }

      if (e.key.toLowerCase() === "r") {
        window.location.reload();
        e.preventDefault();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleTheme]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        shortcutsRef.current &&
        !shortcutsRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={shortcutsRef}>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--control)] hover:text-[var(--card-foreground)]"
        aria-label="Show keyboard shortcuts"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        suppressHydrationWarning
      >
        <kbd className="rounded bg-[var(--control)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--card-foreground)]">
          ?
        </kbd>
        <span>Shortcuts</span>
      </button>
      <ShortcutsModal isOpen={isOpen} onClose={() => setIsOpen(false)} anchorRef={triggerRef} />
    </div>
  );
}
