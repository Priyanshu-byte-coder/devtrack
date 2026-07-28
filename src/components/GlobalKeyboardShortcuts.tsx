"use client";

import { useEffect, useState, useRef } from "react";
import { useTheme } from "@/components/ThemeContext";
import ShortcutsModal from "./ShortcutsModal";

export default function GlobalKeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const { theme, themeDefinition, toggleTheme } = useTheme();
  const keyboardToggleRef = useRef(false);

  useEffect(() => {
    if (keyboardToggleRef.current && theme !== undefined) {
      setAnnouncement(`${themeDefinition?.name ?? "Theme"} enabled`);
    }
    keyboardToggleRef.current = false;
  }, [theme, themeDefinition]);

  useEffect(() => {
    const handleOpenShortcuts = () => {
      setIsOpen(true);
    };
    window.addEventListener("openShortcuts", handleOpenShortcuts);
    return () => {
      window.removeEventListener("openShortcuts", handleOpenShortcuts);
    };
  }, []);

  useEffect(() => {
    let gPressed = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement) {
        const tagName = activeElement.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea" || tagName === "select") return;
        if (activeElement.getAttribute("contenteditable") === "true") return;
      }

      // Show shortcuts modal: ? or Cmd+/ / Ctrl+/
      if (e.key === "?" || ((e.metaKey || e.ctrlKey) && e.key === "/")) {
        setIsOpen((prev) => !prev);
        e.preventDefault();
        return;
      }

      // Time range shortcuts: 1 -> 7d, 2 -> 14d, 3 -> 30d, 4 -> 90d
      const rangeMap: Record<string, number> = {
        "1": 7,
        "2": 14,
        "3": 30,
        "4": 90,
      };
      if (rangeMap[e.key]) {
        const days = rangeMap[e.key];
        try {
          localStorage.setItem("devtrack_dashboard_range", String(days));
        } catch {
          // localStorage access failed
        }
        window.dispatchEvent(
          new CustomEvent("timeRangeChange", { detail: days })
        );
        setAnnouncement(`Switched time range to ${days} days`);
        e.preventDefault();
        return;
      }

      // Alt+T / Option+T to toggle theme
      if (e.altKey && e.key.toLowerCase() === "t") {
        keyboardToggleRef.current = true;
        toggleTheme();
        e.preventDefault();
        return;
      }

      // ESC -> close modal
      if (e.key === "Escape") {
        setIsOpen(false);
        window.dispatchEvent(new Event("closeModal"));
        e.preventDefault();
        return;
      }

      // Reload page / refresh data
      if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey) {
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

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <ShortcutsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}