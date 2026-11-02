"use client";

import { useEffect, useState } from "react";
import FriendComparison from "@/components/FriendComparison";
import dynamic from "next/dynamic";
import PageHeader from "@/components/shell/PageHeader";

const ContributionGraph = dynamic(
  () => import("@/components/ContributionGraph"),
  { ssr: false }
);

export default function FriendComparePage() {
  const [showCommitActivity, setShowCommitActivity] = useState(false);
  const [compareUsername, setCompareUsername] = useState<string | null>(null);

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

    window.addEventListener(
      "devtrack:show-commit-activity",
      handleShowCommitActivity as EventListener
    );
    window.addEventListener(
      "devtrack:clear-compare-user",
      handleClearCommitActivity
    );
    return () => {
      window.removeEventListener(
        "devtrack:show-commit-activity",
        handleShowCommitActivity as EventListener
      );
      window.removeEventListener(
        "devtrack:clear-compare-user",
        handleClearCommitActivity
      );
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
        const persistedFriend = localStorage.getItem(
          "devtrack:compare_username"
        );
        if (persistedFriend) {
          setCompareUsername(persistedFriend);
          setShowCommitActivity(true);
        }
      } catch {
        // Silently fail if localStorage is not available
      }
    }
  }, []);

  return (
    <>
      <PageHeader
        title="Friends"
        description="Put your GitHub stats side by side with anyone on GitHub."
      />
      <div className="space-y-6">
        <FriendComparison />
        {showCommitActivity && <ContributionGraph />}
      </div>
    </>
  );
}
