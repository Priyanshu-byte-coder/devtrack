"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type SVGProps,
} from "react";
import {
  THEME_OPTIONS,
  type ThemeDefinition,
  type ThemeId,
} from "@/lib/themes";
import { useTheme } from "./ThemeContext";

const PaletteIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 2a10 10 0 1 0 10 10c0-.55-.45-1-1-1h-2.5a1.5 1.5 0 0 1 0-3H20a1 1 0 0 0 1-1A10 10 0 0 0 12 2Z" />
    <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="16" cy="8" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="16" cy="16" r="1.25" fill="currentColor" stroke="none" />
  </svg>
);

const ChevronIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** The theme's background with its two accents, as three pixel blocks. */
export function ThemeSwatch({
  theme,
  size = "md",
}: {
  theme: ThemeDefinition;
  size?: "sm" | "md";
}) {
  const [bg, accent, second] = theme.swatch;
  const box = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block shrink-0 ${box}`}
      style={{
        background: bg,
        boxShadow: "inset 0 0 0 1px rgba(127,127,127,0.45)",
      }}
    >
      <span
        className="absolute bottom-[3px] left-[3px] h-1/3 w-1/3"
        style={{ background: accent }}
      />
      <span
        className="absolute right-[3px] top-[3px] h-1/3 w-1/3"
        style={{ background: second }}
      />
    </span>
  );
}

/** Close on outside click and Escape. */
function useDismiss(
  open: boolean,
  close: () => void,
  ref: React.RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, ref]);
}

function ThemeMenu({
  current,
  onSelect,
  placement,
}: {
  current: ThemeId;
  onSelect: (theme: ThemeId) => void;
  placement: "below" | "above";
}) {
  const listRef = useRef<HTMLUListElement>(null);

  // Focus the active item when the menu opens.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
      ?.focus();
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]'
      ) ?? []
    );
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (at + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length;
    items[next]?.focus();
  };

  return (
    <div
      role="menu"
      aria-label="Theme options"
      className={`px-frame px-frame-accent absolute z-50 w-[232px] bg-[var(--card)] p-2 shadow-lg ${
        placement === "above"
          ? "bottom-full left-0 mb-3"
          : "right-0 top-full mt-3"
      }`}
    >
      <p className="px-2 pb-2 pt-1 font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        Select theme
      </p>
      <ul ref={listRef} onKeyDown={onKeyDown} className="space-y-1">
        {THEME_OPTIONS.map((option) => {
          const active = option.id === current;
          return (
            <li key={option.id}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => onSelect(option.id)}
                className={`flex w-full items-center gap-3 px-2 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--foreground)]"
                    : "text-[var(--card-foreground)] hover:bg-[var(--control)]"
                }`}
              >
                <ThemeSwatch theme={option} />
                <span className="min-w-0 flex-1">
                  <span className="block font-pixel text-xs uppercase tracking-[0.06em]">
                    {option.name}
                  </span>
                  <span className="block truncate text-[11px] text-[var(--muted-foreground)]">
                    {option.description}
                  </span>
                </span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="font-pixel text-xs text-[var(--accent)]"
                  >
                    ▶
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type ThemeToggleProps = {
  variant?: "default" | "compact";
};

export default function ThemeToggle({ variant = "default" }: ThemeToggleProps) {
  const { theme, setTheme, themeDefinition } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useRef(() => setOpen(false)).current;
  useDismiss(open, close, containerRef);

  const compact = variant === "compact";

  if (!theme || !themeDefinition) {
    return compact ? (
      <div className="h-8 w-8 shrink-0 border border-[var(--border)] bg-[var(--card)]" />
    ) : (
      <div className="px-frame h-[52px] w-full bg-[var(--card)]" />
    );
  }

  const select = (next: ThemeId) => {
    setTheme(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className={compact ? "relative shrink-0" : "relative w-full"}
    >
      {compact ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-8 w-8 items-center justify-center border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] transition-colors hover:bg-[var(--control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          aria-label="Choose theme"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <PaletteIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={`Theme: ${themeDefinition.name}. Choose theme`}
          aria-haspopup="menu"
          aria-expanded={open}
          className="px-frame flex w-full items-center gap-3 bg-[var(--card)] px-3 py-2 text-left text-[var(--card-foreground)] transition-colors hover:bg-[var(--control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <ThemeSwatch theme={themeDefinition} />
          <span className="min-w-0 flex-1">
            <span className="block font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              Theme
            </span>
            <span className="block truncate font-pixel text-xs uppercase tracking-[0.06em]">
              {themeDefinition.name}
            </span>
          </span>
          <ChevronIcon
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform ${
              open ? "" : "rotate-180"
            }`}
          />
        </button>
      )}

      {open && (
        <ThemeMenu
          current={theme}
          onSelect={select}
          placement={compact ? "below" : "above"}
        />
      )}
    </div>
  );
}
