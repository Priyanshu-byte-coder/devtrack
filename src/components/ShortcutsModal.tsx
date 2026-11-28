"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  key: string;
  actionKey:
    | "toggleTheme"
    | "toggleChart"
    | "reloadData"
    | "goToDashboard"
    | "goToGoals"
    | "closeModal"
    | "showShortcuts";
}

const SHORTCUTS: ShortcutItem[] = [
  { key: "Alt + T", actionKey: "toggleTheme" },
  { key: "B", actionKey: "toggleChart" },
  { key: "R", actionKey: "reloadData" },
  { key: "G + D", actionKey: "goToDashboard" },
  { key: "G + P", actionKey: "goToGoals" },
  { key: "Esc", actionKey: "closeModal" },
  { key: "?", actionKey: "showShortcuts" },
];
export default function ShortcutsModal({
  isOpen,
  onClose,
  anchorRef,
}: ShortcutsModalProps & { anchorRef?: React.RefObject<HTMLElement | null> }) {
  const t = useTranslations("navigation.shortcuts");
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [isMac, setIsMac] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.userAgent));
    }
  }, []);

  // Recalculate position whenever the modal opens or the window resizes
  useEffect(() => {
    if (!isOpen || !anchorRef?.current) return;

    const calculate = () => {
      const rect = anchorRef.current!.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    };

    calculate();
    window.addEventListener("resize", calculate);
    window.addEventListener("scroll", calculate, true);
    return () => {
      window.removeEventListener("resize", calculate);
      window.removeEventListener("scroll", calculate, true);
    };
  }, [isOpen, anchorRef]);

  useEffect(() => {
    if (!isOpen) {
      // Restore focus on close
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
      return;
    }

    // The modal renders null until `mounted` flips true, so on the first pass
    // closeBtnRef is still empty. Wait for the DOM to exist, otherwise focus
    // never enters the dialog and a keyboard user is left outside it.
    if (!mounted) return;

    // Save previous active element to restore later, only on initial open
    if (!previousFocusRef.current) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      closeBtnRef.current?.focus();
    }

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab") {
        if (!modalRef.current) return;

        const focusableElements =
          modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    // Prevent focus from escaping the modal programmatically or via browser UI interactions
    const handleFocusIn = (e: FocusEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        closeBtnRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [isOpen, onClose, mounted]);

  if (!isOpen || !mounted) return null;

  const style: React.CSSProperties = position
    ? { position: "fixed", top: position.top, right: position.right }
    : { position: "fixed", top: 64, right: 16 };

  const modal = (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      style={{ ...style, zIndex: 9999, width: 320 }}
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h2
          id="shortcuts-title"
          className="text-sm font-semibold text-[var(--card-foreground)]"
        >
          {t("modalTitle")}
        </h2>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-[var(--muted-foreground)] transition-[background-color,color,opacity,transform] hover:bg-[var(--control)] hover:text-[var(--card-foreground)] hover:opacity-90 active:scale-95"
          aria-label={t("closeAria")}
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-3">
        {SHORTCUTS.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between border-b border-border/50 py-2 last:border-0"
          >
            <span className="text-sm text-[var(--muted-foreground)]">
              {t(`actions.${item.actionKey}`)}
            </span>
            <kbd className="min-w-[28px] rounded-md border border-[var(--border)] bg-[var(--control)] px-2 py-1 text-center text-xs font-semibold text-[var(--card-foreground)] shadow-sm">
              {item.key === "T" ? (isMac ? "Option + T" : "Alt + T") : item.key}
            </kbd>
          </div>
        ))}
      </div>

      <div className="flex justify-end border-t border-[var(--border)] px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-[var(--control)] px-4 py-2 text-sm font-medium text-[var(--card-foreground)] transition-[background-color,color,opacity,transform] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] hover:opacity-90 active:scale-95"
        >
          {t("gotIt")}
        </button>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
