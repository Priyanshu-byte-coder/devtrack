"use client";

/**
 * A number that springs up to its value the first time it scrolls into view.
 *
 * Adapted from Motion Primitives' AnimatedNumber (MIT, (c) 2024 ibelick,
 * https://github.com/ibelick/motion-primitives). Changes:
 * - the server renders the real value, so crawlers and no-JS visitors see the
 *   number rather than 0; the count-up only runs for numbers that start
 *   below the fold, so nothing visible flashes back to zero on hydration
 * - formats with a fixed locale, since server and browser locales can differ
 *   and `toLocaleString()` would then cause a hydration mismatch
 * - the element is a stable `m.span` instead of `motion.create()` called on
 *   every render, which remounted it each time
 * - honours reduced motion by showing the value without animating
 */

import {
  m,
  useInView,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { spring as springTokens } from "@/lib/motion";

const formatter = new Intl.NumberFormat("en-US");

// useLayoutEffect warns during SSR; this runs it only in the browser.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

interface AnimatedNumberProps {
  value: number;
  className?: string;
  /** Override the spring, e.g. `spring.bouncy` for a celebration. */
  springOptions?: { stiffness?: number; damping?: number; mass?: number };
  format?: (n: number) => string;
}

export function AnimatedNumber({
  value,
  className,
  springOptions = springTokens.smooth,
  format = (n) => formatter.format(n),
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const { stiffness, damping, mass } = springOptions;
  const motionValue = useSpring(value, { stiffness, damping, mass });
  const display = useTransform(motionValue, (n) => format(Math.round(n)));

  // Before first paint: numbers already on screen keep their value; numbers
  // below the fold reset to 0 so they can count up when reached.
  useIsomorphicLayoutEffect(() => {
    if (reduce || !ref.current) return;
    const { top } = ref.current.getBoundingClientRect();
    if (top > window.innerHeight) motionValue.jump(0);
    // Only on mount: later value changes animate from wherever the number is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reduce) motionValue.jump(value);
    else if (inView) motionValue.set(value);
  }, [inView, motionValue, reduce, value]);

  return (
    <m.span ref={ref} className={`tabular-nums ${className ?? ""}`}>
      {display}
    </m.span>
  );
}
