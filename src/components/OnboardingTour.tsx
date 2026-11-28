"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

/** Set as soon as the tour starts, so it never shows twice in one browser. */
export const TOUR_SEEN_KEY = "devtrack:onboarding-seen";

type StepKey =
  "welcome" | "stats" | "rank" | "activity" | "focus" | "nav" | "gameOn";

interface TourStepDefinition {
  element?: string;
  key: StepKey;
}

const TOUR_STEP_DEFINITIONS: TourStepDefinition[] = [
  { key: "welcome" },
  { element: '[data-tour="stats"]', key: "stats" },
  { element: '[data-tour="rank"]', key: "rank" },
  { element: '[data-tour="activity"]', key: "activity" },
  { element: '[data-tour="focus"]', key: "focus" },
  { element: '[data-tour="nav"]', key: "nav" },
  { key: "gameOn" },
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
  const t = useTranslations("navigation.onboarding");

  const steps = useMemo<DriveStep[]>(() => {
    return TOUR_STEP_DEFINITIONS.map((def) => {
      const step: DriveStep = {
        popover: {
          title: t(`steps.${def.key}.title`),
          description: t(`steps.${def.key}.description`),
        },
      };
      if (def.element) {
        step.element = def.element;
      }
      return step;
    });
  }, [t]);

  useEffect(() => {
    if (pathname !== "/dashboard") return;
    if (window.navigator.webdriver || alreadySeen()) return;

    // Let the widgets render first, so the steps have something to point at.
    const timer = window.setTimeout(() => {
      if (alreadySeen()) return;
      const visibleSteps = steps.filter(
        (step) => typeof step.element !== "string" || isVisible(step.element)
      );
      markSeen();
      const tour = driver({
        steps: visibleSteps,
        showProgress: true,
        progressText: "{{current}} / {{total}}",
        nextBtnText: t("nextBtnText"),
        prevBtnText: t("prevBtnText"),
        doneBtnText: t("doneBtnText"),
        popoverClass: "devtrack-tour",
        overlayColor: "#05070f",
        stagePadding: 6,
        stageRadius: 0,
        allowClose: true,
      });
      tour.drive();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [pathname, steps, t]);

  return null;
}
