"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ArrowUp } from "lucide-react";

interface BackToTopButtonProps {
  /** Scroll distance in px before button appears. Default: 300 */
  threshold?: number;
  /** Optional id of a scrollable container. If omitted uses window. */
  scrollContainerId?: string;
}

export default function BackToTopButton({
  threshold = 300,
  scrollContainerId,
}: BackToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const getScrollTarget = useCallback((): Element | Window => {
    if (scrollContainerId) {
      return document.getElementById(scrollContainerId) ?? window;
    }
    return window;
  }, [scrollContainerId]);

  const handleScroll = useCallback(() => {
    const target = getScrollTarget();

    let scrollTop: number;
    let scrollHeight: number;
    let clientHeight: number;

    if (target instanceof Window) {
      scrollTop = window.scrollY;
      scrollHeight = document.documentElement.scrollHeight;
      clientHeight = window.innerHeight;
    } else {
      scrollTop = (target as Element).scrollTop;
      scrollHeight = (target as Element).scrollHeight;
      clientHeight = (target as Element).clientHeight;
    }

    const docHeight = scrollHeight - clientHeight;
    const progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;

    setIsVisible(scrollTop > threshold);
    setScrollProgress(progress);
  }, [getScrollTarget, threshold]);

  const scrollToTop = useCallback(() => {
    const target = getScrollTarget();
    if (target instanceof Window) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      (target as Element).scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [getScrollTarget]);

  useEffect(() => {
    const target = getScrollTarget();
    const eventTarget = target instanceof Window ? window : (target as Element);
    eventTarget.addEventListener("scroll", handleScroll, { passive: true });
    return () => eventTarget.removeEventListener("scroll", handleScroll);
  }, [getScrollTarget, handleScroll]);

  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - scrollProgress);
  const ringColor = "#3b82f6";

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <div className="relative flex items-center justify-center">
        <svg
          className="absolute h-14 w-14 -rotate-90"
          viewBox="0 0 56 56"
          aria-hidden="true"
        >
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="4"
            opacity="0.15"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              filter: "drop-shadow(0 0 6px rgba(59, 130, 246, 0.6))",
            }}
            className="transition-[stroke-dashoffset] duration-100"
          />
        </svg>
        <button
          onClick={scrollToTop}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              scrollToTop();
            }
          }}
          type="button"
          aria-label="Scroll back to top of agents list"
          title="Back to top"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-md text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <ArrowUp size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}