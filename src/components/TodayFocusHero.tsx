"use client";

import { useEffect, useState } from "react";
import { Target } from "lucide-react";

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

function getDailyPrompt(date = new Date()): string {
  const dayIndex = Math.floor(date.getTime() / 86400000);
  return PROMPTS[Math.abs(dayIndex) % PROMPTS.length];
}

/** Compact daily-focus card: one goal for today, saved locally and to the API. */
export default function TodayFocusHero() {
  const [goal, setGoal] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [todayKey, setTodayKey] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const now = new Date();
    const nextKey = getTodayKey(now);
    setTodayKey(nextKey);
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

  const inputClass =
    "min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] disabled:opacity-50";
  const smallButton =
    "rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section
      aria-labelledby="today-focus-title"
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <Target className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
        <h2
          id="today-focus-title"
          className="text-sm font-semibold text-[var(--card-foreground)]"
        >
          Today&apos;s focus
        </h2>
      </div>

      {!isMounted ? (
        <div className="h-9 rounded-lg skeleton-shimmer" />
      ) : goal && !isEditing ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-sm font-medium text-[var(--card-foreground)]">
            {goal}
          </p>
          <button
            type="button"
            onClick={handleEdit}
            className={`${smallButton} secondary-button`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={isClearing || isSaving}
            className={`${smallButton} text-[var(--muted-foreground)] hover:text-[var(--destructive)]`}
          >
            {isClearing ? "Clearing..." : "Done"}
          </button>
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <label className="sr-only" htmlFor="today-focus-input">
            Write your main dev goal for today
          </label>
          <input
            id="today-focus-input"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            disabled={isSaving || isClearing}
            placeholder={prompt}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isSaving || isClearing}
            className={`${smallButton} primary-button`}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </form>
      )}
    </section>
  );
}
