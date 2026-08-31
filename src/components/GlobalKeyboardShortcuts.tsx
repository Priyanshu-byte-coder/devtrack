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

      // Show shortcuts modal
      if (e.key === "?") {
        setIsOpen(true);
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

      // Toggle chart
      if (e.key.toLowerCase() === "b") {
        window.dispatchEvent(new Event("toggleChart"));
        e.preventDefault();
        return;
      }

      // G key handling (chord detection)
      if (e.key.toLowerCase() === "g") {
        gPressed = true;
        setTimeout(() => {
          gPressed = false;
        }, 1000);
        e.preventDefault();
        return;
      }

      // G + D -> Dashboard
      if (gPressed && e.key.toLowerCase() === "d") {
        window.location.href = "/dashboard";
        e.preventDefault();
        return;
      }

      // G + P -> Goals (scroll to goals section)
      if (gPressed && e.key.toLowerCase() === "p") {
        const goalSection = document.getElementById("goals-section");
        if (goalSection) {
          goalSection.scrollIntoView({ behavior: "smooth", block: "center" });
        }
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

      // Reload page
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

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <ShortcutsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}