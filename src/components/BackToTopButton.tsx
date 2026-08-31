"use client";

import React, { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = () => {
    if (typeof window !== "undefined") {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
      setIsVisible(scrollTop > 300);
      setScrollProgress(progress);
    }
  };

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", handleScroll);
      };
    }
  }, []);

  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - scrollProgress);

  const ringColor = "var(--accent)";

  return (
    <>
      {isVisible && (
        <div className="fixed bottom-8 right-8 z-50">
          <div className="relative flex items-center justify-center">
            <svg
              className="absolute h-14 w-14 -rotate-90"
              viewBox="0 0 56 56"
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
                style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 60%, transparent))" }}
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
              aria-label="Back to top"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-md text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            >
              <ArrowUp size={24} aria-hidden="true" className="text-white/90" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
