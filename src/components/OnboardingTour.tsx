"use client";

import { useEffect, useCallback } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_STEPS = [
  {
    element: "#widget-contribution-graph",
    popover: {
      title: "Contribution Graph",
      description: "See your daily GitHub commit activity. Switch between 7, 14, 30, and 90 day views.",
    },
  },
  {
    element: "#widget-streak",
    popover: {
      title: "Streak Tracker",
      description: "Your current commit streak — how many days in a row you've pushed code.",
    },
  },
  {
    element: "#widget-pr-metrics",
    popover: {
      title: "PR Analytics",
      description: "Average review time, merge rate, and open vs closed pull request counts.",
    },
  },
  {
    element: "#widget-top-repos",
    popover: {
      title: "Top Repositories",
      description: "Your most active repos ranked by commits. Click column headers to sort.",
    },
  },
  {
    element: "#widget-goals",
    popover: {
      title: "Weekly Goals",
      description: "Set coding targets and track your progress automatically.",
    },
  },
];

async function markTourSeen() {
  try {
    await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seen_onboarding: true }),
    });
  } catch {
    // silent fail — not critical
  }
}

export default function OnboardingTour() {
  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      steps: TOUR_STEPS,
      onDestroyStarted: () => {
        markTourSeen();
        driverObj.destroy();
      },
    });

    driverObj.drive();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.navigator.webdriver) return;
    const timer = setTimeout(startTour, 800);
    return () => clearTimeout(timer);
  }, [startTour]);

  return null;
}
