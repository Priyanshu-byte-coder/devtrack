"use client";

// Compact navbar variant uses ThemeId + THEME_OPTIONS (not legacy Theme/themes exports).
import { useEffect, useRef, useState, type SVGProps } from "react";
import { THEME_OPTIONS, type ThemeId } from "@/lib/themes";
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

const CheckIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

type ThemeToggleProps = {
  variant?: "default" | "compact";
};

function CompactThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!mounted || !theme) {
    return (
      <div className="inline-flex h-8 w-8 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card)]" />
    );
  }

  const handleSelect = (nextTheme: ThemeId) => {
    setTheme(nextTheme);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] transition-all duration-200 hover:bg-[var(--control)] active:scale-95"
        aria-label="Choose theme"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <PaletteIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Theme options"
          className="absolute right-0 top-full z-50 mt-2 w-[220px] rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg"
        >
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            Theme
          </p>
          <ul className="mt-1 space-y-0.5">
            {THEME_OPTIONS.map((option) => {
              const isActive = theme === option.id;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => handleSelect(option.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                      isActive
                        ? "bg-[var(--accent-soft)] text-[var(--foreground)]"
                        : "text-[var(--card-foreground)] hover:bg-[var(--control)]"
                    }`}
                  >
                    <span
                      className={`h-3 w-3 shrink-0 rounded-full border border-black/10 ${
                        option.mode === "dark" ? "bg-slate-700" : "bg-sky-200"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{option.name}</span>
                      <span className="block truncate text-[10px] text-[var(--muted-foreground)]">
                        {option.description}
                      </span>
                    </span>
                    {isActive && (
                      <CheckIcon className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function DefaultThemeToggle() {
  const { theme, setTheme, themeDefinition } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !theme) {
    return (
      <div className="inline-flex h-12 w-full max-w-[260px] items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 shadow-sm" />
    );
  }

  const currentLabel = themeDefinition?.name ?? "Theme";
  const currentDescription = themeDefinition?.description ?? "Customize the dashboard palette";

  return (
    <label className="inline-flex min-h-12 w-full max-w-[220px] md:max-w-[260px] cursor-pointer items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--card-foreground)] shadow-sm transition-all duration-300 hover:bg-[var(--control)] focus-within:border-[var(--accent)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
        <PaletteIcon className="h-4 w-4" aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          Theme
        </span>
        <span className="block truncate text-sm font-semibold text-[var(--card-foreground)]">
          {currentLabel}
        </span>
        <span className="block truncate text-xs text-[var(--muted-foreground)]">
          {currentDescription}
        </span>
      </span>

      <span className="relative flex items-center gap-2">
        <select
          aria-label="Select dashboard theme"
          value={theme}
          onChange={(event) => setTheme(event.target.value as ThemeId)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {THEME_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>

        <span className="text-xs font-medium text-[var(--muted-foreground)]">Change</span>
        <ChevronIcon className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
      </span>
    </label>
  );
}

export default function ThemeToggle({ variant = "default" }: ThemeToggleProps) {
  if (variant === "compact") {
    return <CompactThemeToggle />;
  }

  return <DefaultThemeToggle />;
}
