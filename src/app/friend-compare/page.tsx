"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import FriendComparison from "@/components/FriendComparison";
import dynamic from "next/dynamic";
import Link from "next/link";

const ContributionGraph = dynamic(
  () => import("@/components/ContributionGraph"),
  { ssr: false }
);

export default function FriendComparePage() {
  const { data: session, status } = useSession();
  const [showCommitActivity, setShowCommitActivity] = useState(false);
  const [compareUsername, setCompareUsername] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/");
    }
  }, [status]);

  useEffect(() => {
    const handleShowCommitActivity = (e: Event) => {
      const customEvent = e as CustomEvent<{ username?: string }>;
      const username = customEvent.detail?.username;
      setCompareUsername(username || null);
      setShowCommitActivity(true);
    };

    const handleClearCommitActivity = () => {
      setShowCommitActivity(false);
      setCompareUsername(null);
    };

    window.addEventListener("devtrack:show-commit-activity", handleShowCommitActivity as EventListener);
    window.addEventListener("devtrack:clear-compare-user", handleClearCommitActivity);
    return () => {
      window.removeEventListener("devtrack:show-commit-activity", handleShowCommitActivity as EventListener);
      window.removeEventListener("devtrack:clear-compare-user", handleClearCommitActivity);
    };
  }, []);

  // When showCommitActivity becomes true, dispatch the compare event after a tick
  useEffect(() => {
    if (showCommitActivity && compareUsername) {
      // Dispatch after the component has fully mounted (1000ms delay ensures dynamic import + listener setup)
      const timer = setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("devtrack:compare-user", {
            detail: { username: compareUsername },
          })
        );
        // Scroll to the element
        const element = document.getElementById("contribution-activity");
        if (element) {
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - 100;
          window.scrollTo({ top: offsetPosition, behavior: "smooth" });
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showCommitActivity, compareUsername]);

  // Auto-show commit activity if a friend was persisted on page refresh
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const persistedFriend = localStorage.getItem("devtrack:compare_username");
        if (persistedFriend) {
          setCompareUsername(persistedFriend);
          setShowCommitActivity(true);
        }
      } catch {
        // Silently fail if localStorage is not available
      }
    }
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[var(--background)] p-4 text-[var(--foreground)] transition-colors md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 bg-[var(--card-muted)] rounded-lg animate-pulse mx-auto mb-4" />
          <p className="text-[var(--muted-foreground)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 text-[var(--foreground)] transition-colors md:p-8">
      {/* Header */}
      <div className="mb-8 max-w-6xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-3 py-2 mb-4 text-sm font-medium rounded-lg bg-[var(--control)] text-[var(--foreground)] hover:bg-[var(--card)] transition-colors border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
        <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-[var(--foreground)] via-[var(--foreground)] to-[var(--accent)] bg-clip-text text-transparent">
          Friend Comparison
        </h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Compare your GitHub stats with friends and see how you stack up
        </p>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto space-y-6">
        <FriendComparison />

        {/* Commit Activity Comparison - Only rendered when button is clicked */}
        {showCommitActivity && (
          <ContributionGraph />
        )}
      </div>
    </div>
  );
}
