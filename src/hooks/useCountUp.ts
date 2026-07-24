"use client";

import { useState, useEffect, useRef } from "react";

export function useCountUp(target: number, duration?: number): number {
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);
  const prevTargetRef = useRef(target);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (mediaQuery.matches) {
      setCount(target);
      return;
    }

    if (prevTargetRef.current !== target) {
      hasAnimated.current = false;
      prevTargetRef.current = target;
      setCount(0);
    }

    if (target <= 0) {
      setCount(0);
      return;
    }

    if (hasAnimated.current) {
      setCount(target);
      return;
    }

    const actualDuration =
      duration ?? (target <= 10 ? 500 : target <= 50 ? 650 : 800);

    if (actualDuration <= 0) {
      setCount(target);
      hasAnimated.current = true;
      return;
    }

    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      if (startTime === null) {
        startTime = currentTime;
      }

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / actualDuration, 1);

      const easeOutQuint = 1 - Math.pow(1 - progress, 5);
      const currentCount = Math.round(easeOutQuint * target);

      setCount(currentCount);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setCount(target);
        hasAnimated.current = true;
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [target, duration]);

  return count;
}
