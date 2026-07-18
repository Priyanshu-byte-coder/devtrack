"use client";

import { useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";

type TodayFocusHeroProps = {
  userName?: string | null;
};

const PROMPTS = [
  "What are you building today?",
  "What is one small win you want today?",
  "Ship one meaningful thing today.",
  "What problem are you solving today?",
  "Make one part of your project better today.",
];

const STORAGE_PREFIX = "devtrack_today_goal_";

function getTodayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${STORAGE_PREFIX}${year}-${month}-${day}`;
}

function getGreeting(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function getDailyPrompt(date = new Date()): string {
  const dayIndex = Math.floor(date.getTime() / 86400000);
  return PROMPTS[Math.abs(dayIndex) % PROMPTS.length];
}

export default function TodayFocusHero({ userName }: TodayFocusHeroProps) {
  const [goal, setGoal] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [greeting, setGreeting] = useState<"morning" | "afternoon" | "evening">("morning");
  const [todayKey, setTodayKey] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const isMobile = useIsMobile();

  const greetingLabel = useMemo(() => {
    const base =
      greeting === "morning"
        ? "Good morning"
        : greeting === "afternoon"
          ? "Good afternoon"
          : "Good evening";
   if (isMobile && userName?.trim()) {
    return `${base}, ${userName.trim().split(" ")[0]}`; 
  }
    return userName?.trim() ? `${base}, ${userName.trim()}` : base;
  }, [greeting, userName, isMobile]);

  useEffect(() => {
    const now = new Date();
    const nextKey = getTodayKey(now);
    setTodayKey(nextKey);
    setGreeting(getGreeting(now.getHours()));
    setPrompt(getDailyPrompt(now));

    let localGoal = "";
    try {
      localGoal = window.localStorage.getItem(nextKey)?.trim() ?? "";
      setGoal(localGoal);
      setInputValue(localGoal);
      setIsEditing(localGoal.length === 0);
    } catch (e) {
      setGoal("");
      setInputValue("");
      setIsEditing(true);
    }

    setIsMounted(true);

    async function fetchGoal() {
      try {
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const todayStr = `${year}-${month}-${day}`;

        const res = await fetch(`/api/daily-focus?date=${todayStr}`);
        if (res.ok) {
          const data = await res.json();
          if (data.goal) {
            setGoal(data.goal);
            setInputValue(data.goal);
            setIsEditing(false);
            try {
              window.localStorage.setItem(nextKey, data.goal);
            } catch (e) {}
          }
        }
      } catch (err) {
        console.error("Failed to fetch daily focus", err);
      }
    }
    
    fetchGoal();
  }, []);

  async function handleSave() {
    const trimmedGoal = inputValue.trim();
    if (!trimmedGoal || !todayKey) return;

    setIsSaving(true);
    try {
      window.localStorage.setItem(todayKey, trimmedGoal);
    } catch (e) {}

    setGoal(trimmedGoal);
    setInputValue(trimmedGoal);
    setIsEditing(false);

    try {
      const todayStr = todayKey.replace(STORAGE_PREFIX, "");
      await fetch("/api/daily-focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_text: trimmedGoal, date: todayStr }),
      });
    } catch (err) {
      console.error("Failed to save daily focus", err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClear() {
    if (!todayKey) return;

    setIsClearing(true);
    try {
      window.localStorage.removeItem(todayKey);
    } catch (e) {}

    setGoal("");
    setInputValue("");
    setIsEditing(true);

    try {
      const todayStr = todayKey.replace(STORAGE_PREFIX, "");
      await fetch(`/api/daily-focus?date=${todayStr}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to clear daily focus", err);
    } finally {
      setIsClearing(false);
    }
  }

  function handleEdit() {
    setInputValue(goal);
    setIsEditing(true);
  }

  if (!isMounted) {
    return (
      <section className="surface-card fade-up relative overflow-hidden rounded-3xl border border-[var(--border)] px-5 py-6 shadow-sm md:px-8 md:py-8">
        <div className="space-y-4">
          <div className="h-6 w-52 rounded skeleton-shimmer" />
          <div className="h-4 w-full max-w-xl rounded skeleton-shimmer" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="h-12 rounded-xl skeleton-shimmer" />
            <div className="flex gap-3">
              <div className="h-12 w-24 rounded-xl skeleton-shimmer" />
              <div className="h-12 w-24 rounded-xl skeleton-shimmer" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="surface-card fade-up relative overflow-hidden rounded-3xl border border-[var(--border)] px-5 py-6 shadow-sm md:px-8 md:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.1),transparent_28%)]" />
      <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-[var(--accent-soft)] blur-3xl" />

      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.95fr)] lg:items-stretch">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Today&apos;s Focus
            </p>
            <h1
              className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl"
              style={{ fontFamily: "var(--font-syne, system-ui, sans-serif)" }}
            >
              {greetingLabel}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">
              {prompt}
            </p>
          </div>

          <p className="text-sm text-[var(--muted-foreground)] sm:text-base">
            Progress is built one focused session at a time.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_92%,white_8%)] p-4 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.35)] sm:p-5">
          {goal && !isEditing ? (
            <div className="flex h-full flex-col justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Today&apos;s Focus
                </p>
                <p className="text-lg font-semibold leading-7 text-[var(--card-foreground)] sm:text-xl">
                  {goal}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleEdit}
                  className="secondary-button inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-medium sm:w-auto"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isClearing || isSaving}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-[var(--destructive-muted-border)] bg-[var(--destructive-muted)] px-4 py-3 text-sm font-medium text-[var(--destructive)] transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                >
                  {isClearing ? "Clearing..." : "Clear"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Set your goal for today
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Save a single goal for this day. You can update it anytime.
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <label className="block">
                  <span className="sr-only">Write your main dev goal for today</span>
                  <input
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    disabled={isSaving || isClearing}
                    placeholder="Write your main dev goal for today..."
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] shadow-sm transition placeholder:text-[var(--muted-foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </label>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!inputValue.trim() || isSaving || isClearing}
                    className="primary-button inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto lg:w-full xl:w-auto"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                  {goal ? (
                    <button
                      type="button"
                      onClick={handleClear}
                      disabled={isSaving || isClearing}
                      className="secondary-button inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto lg:w-full xl:w-auto"
                    >
                      {isClearing ? "Clearing..." : "Clear"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
