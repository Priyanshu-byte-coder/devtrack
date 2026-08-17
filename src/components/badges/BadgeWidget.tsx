"use client";

import React, { useEffect, useState } from "react";
import type { BadgeStatus } from "@/lib/badges/badge-evaluator";

export default function BadgeWidget() {
  const [badges, setBadges] = useState<BadgeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBadges = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/badges");
      if (!res.ok) throw new Error("Failed to fetch badges");
      const data = await res.json();
      setBadges(data.badges || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load achievements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBadges();
    
    // Setup event listener to auto-refresh on devtrack:sync
    const handleSync = () => fetchBadges();
    window.addEventListener("devtrack:sync", handleSync);
    return () => window.removeEventListener("devtrack:sync", handleSync);
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">Achievement Badges</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-[var(--card-muted)]" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">Achievement Badges</h2>
        <p className="text-sm text-[var(--destructive)]">{error}</p>
        <button
          onClick={fetchBadges}
          className="mt-3 rounded border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--control)] transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)] flex items-center gap-2">
        Achievement Badges
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {badges.map((badge) => (
          <div
            key={badge.id}
            tabIndex={0}
            className={`group relative flex flex-col items-center justify-center rounded-xl border p-4 text-center transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] hover:shadow-md ${
              badge.isUnlocked
                ? "border-[var(--accent)]/40 bg-[var(--accent-soft)]"
                : "border-[var(--border)] bg-[var(--control)] opacity-70 grayscale"
            }`}
            aria-label={`${badge.name}: ${badge.description}. ${
              badge.isUnlocked ? "Unlocked" : "Locked"
            }`}
          >
            <div
              className={`text-3xl transition-transform duration-300 ${
                badge.isUnlocked ? "scale-110 group-hover:scale-125" : ""
              }`}
            >
              {badge.icon}
            </div>
            <span
              className={`mt-2 block text-xs font-bold ${
                badge.isUnlocked ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"
              }`}
            >
              {badge.name}
            </span>

            {/* Tooltip */}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 scale-95 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100">
              <div className="rounded-lg bg-[var(--foreground)] px-3 py-2 text-center text-xs font-medium text-[var(--background)] shadow-lg">
                <p className="mb-1">{badge.description}</p>
                {badge.progress && !badge.isUnlocked && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--background)]/30">
                    <div
                      className="h-full bg-[var(--background)]"
                      style={{
                        width: `${Math.min(
                          (badge.progress.current / badge.progress.target) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                )}
                {badge.isUnlocked && badge.unlockedAt && (
                  <p className="mt-1 border-t border-[var(--background)]/20 pt-1 text-[10px] opacity-80">
                    Unlocked: {new Date(badge.unlockedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="mx-auto h-2 w-2 origin-top-left rotate-45 transform bg-[var(--foreground)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
