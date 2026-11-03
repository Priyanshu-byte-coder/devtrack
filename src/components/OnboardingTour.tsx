"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

/** Set as soon as the tour starts, so it never shows twice in one browser. */
export const TOUR_SEEN_KEY = "devtrack:onboarding-seen";

const STEPS: DriveStep[] = [
  {
    popover: {
      title: "Player 1 ready",
      description:
        "Your GitHub activity is now a game: streaks, XP, tiers and a global leaderboard. Want a 20-second tour?",
    },
  },
  {
    element: '[data-tour="stats"]',
    popover: {
      title: "Your week",
      description:
        "Streak, commits, merged PRs and active days, compared with last week. They update on their own.",
    },
  },
  {
    element: '[data-tour="rank"]',
    popover: {
      title: "Rank, tier and XP",
      description:
        "Your place this season, your tier, and XP toward the next level. Ranks update every day.",
    },
  },
  {
    element: '[data-tour="activity"]',
    popover: {
      title: "Activity",
      description:
        "Your commits over time. Switch the range or the chart type to spot your rhythm.",
    },
  },
  {
    element: '[data-tour="focus"]',
    popover: {
      title: "Today's focus",
      description:
        "Write down what you're building today. Small goals keep streaks alive.",
    },
  },
  {
    element: '[data-tour="nav"]',
    popover: {
      title: "More modes",
      description:
        "Pull requests, repos, goals, Year in Code and your public profile all live here.",
    },
  },
  {
    popover: {
      title: "Game on",
      description:
        "Climb the leaderboard, flex your badges in your README, and challenge friends to duels.",
    },
  },
];

function isVisible(selector: string) {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function markSeen() {
  try {
    window.localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // Storage blocked: the server flag below still covers it.
  }
  fetch("/api/user/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seen_onboarding: true }),
  }).catch(() => {});
}

function alreadySeen() {
  try {
    return window.localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The first-run tour of the overview page. Shown once per account: it is
 * marked seen the moment it starts (server flag plus a local mark), so
 * leaving halfway or opening another tab never brings it back.
 */
export default function OnboardingTour() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/dashboard") return;
    if (window.navigator.webdriver || alreadySeen()) return;

    // Let the widgets render first, so the steps have something to point at.
    const timer = window.setTimeout(() => {
      if (alreadySeen()) return;
      const steps = STEPS.filter(
        (step) => typeof step.element !== "string" || isVisible(step.element)
      );
      markSeen();
      const tour = driver({
        steps,
        showProgress: true,
        progressText: "{{current}} / {{total}}",
        nextBtnText: "Next ▶",
        prevBtnText: "◀ Back",
        doneBtnText: "Start playing",
        popoverClass: "devtrack-tour",
        overlayColor: "#05070f",
        stagePadding: 6,
        stageRadius: 0,
        allowClose: true,
      });
      tour.drive();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
