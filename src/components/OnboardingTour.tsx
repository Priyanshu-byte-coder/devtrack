"use client";

import { useCallback, useEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const LOCAL_TOUR_KEY = "devtrack-dashboard-onboarding-completed";
export const REPLAY_TOUR_EVENT = "devtrack:replay-dashboard-tour";

const TOUR_STEPS = [
  {
    element: "#widget-contribution-graph",
    popover: {
      title: "Contribution Graph",
      description:
        "See your daily GitHub contribution activity and understand how consistently you are coding.",
    },
  },
  {
    element: "#widget-streak-tracker",
    popover: {
      title: "Coding Streak",
      description:
        "Track how many consecutive days you have recorded GitHub activity.",
    },
  },
  {
    element: "#widget-pr-metrics",
    popover: {
      title: "Pull Request Analytics",
      description:
        "Review your pull request activity, merge performance, and collaboration metrics.",
    },
  },
  {
    element: "#widget-language-breakdown",
    popover: {
      title: "Language Breakdown",
      description:
        "Understand which programming languages you use most across your repositories.",
    },
  },
  {
    element: "#widget-top-repos",
    popover: {
      title: "Top Repositories",
      description:
        "View your most active repositories and quickly identify where most of your work happens.",
    },
  },
  {
    element: "#widget-goal-tracker",
    popover: {
      title: "Set Your First Goal",
      description:
        "Create a coding goal and let DevTrack automatically monitor your progress.",
    },
  },
];

async function markTourSeen() {
  try {
    window.localStorage.setItem(LOCAL_TOUR_KEY, "true");
  } catch {
    // localStorage may be unavailable in restricted browser environments.
  }

  try {
    await fetch("/api/user/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        seen_onboarding: true,
      }),
    });
  } catch {
    // The local completion flag prevents the tour from repeatedly appearing
    // when the remote settings request is temporarily unavailable.
  }
}

interface OnboardingTourProps {
  autoStart?: boolean;
}

export default function OnboardingTour({
  autoStart = true,
}: OnboardingTourProps) {
  const automaticStartHandled = useRef(false);

  const startTour = useCallback((forceReplay = false) => {
    if (typeof window === "undefined") return;

    if (!forceReplay) {
      try {
        const alreadyCompleted =
          window.localStorage.getItem(LOCAL_TOUR_KEY) === "true";

        if (alreadyCompleted) return;
      } catch {
        // Continue using the remote setting when localStorage is unavailable.
      }
    }

    const availableSteps = TOUR_STEPS.filter(({ element }) =>
      document.querySelector(element)
    );

    if (availableSteps.length === 0) return;

    let completionSaved = false;
    let focusGoalAfterClose = false;

    const saveCompletion = () => {
      if (completionSaved) return;

      completionSaved = true;
      void markTourSeen();
    };

    const driverObject = driver({
      animate: true,
      allowClose: true,
      allowScroll: true,
      showProgress: true,
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Set first goal",
      overlayOpacity: 0.65,
      stagePadding: 8,
      stageRadius: 12,
      popoverOffset: 12,
      steps: availableSteps,

      onPopoverRender: (popover) => {
        if (popover.footerButtons.querySelector(".devtrack-tour-skip-button")) {
          return;
        }

        const skipButton = document.createElement("button");

        skipButton.type = "button";
        skipButton.textContent = "Skip tour";
        skipButton.className =
          "driver-popover-footer-btn devtrack-tour-skip-button";

        skipButton.addEventListener("click", () => {
          driverObject.destroy();
        });

        popover.footerButtons.appendChild(skipButton);
      },

      onDoneClick: () => {
        focusGoalAfterClose = true;
        driverObject.destroy();
      },

      onDestroyStarted: () => {
        saveCompletion();
        driverObject.destroy();

        if (focusGoalAfterClose) {
          window.setTimeout(() => {
            const goalWidget = document.querySelector<HTMLElement>(
              "#widget-goal-tracker"
            );

            goalWidget?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });

            const firstGoalControl = goalWidget?.querySelector<HTMLElement>(
              'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );

            firstGoalControl?.focus({
              preventScroll: true,
            });
          }, 150);
        }
      },
    });

    driverObject.drive();
  }, []);

  useEffect(() => {
    const handleReplay = () => {
      startTour(true);
    };

    window.addEventListener(REPLAY_TOUR_EVENT, handleReplay);

    return () => {
      window.removeEventListener(REPLAY_TOUR_EVENT, handleReplay);
    };
  }, [startTour]);

  useEffect(() => {
    if (!autoStart || automaticStartHandled.current) return;
    if (window.navigator.webdriver) return;

    automaticStartHandled.current = true;

    const timer = window.setTimeout(() => {
      startTour(false);
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoStart, startTour]);

  return null;
}
