"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { duration, ease } from "@/lib/motion";

/**
 * App-wide motion setup.
 *
 * - `LazyMotion` + `domAnimation` ships only the animation features we use,
 *   and `strict` makes a stray full `motion.*` import an error, so components
 *   use the lighter `m.*` elements.
 * - `reducedMotion="user"` follows the OS setting. Our primitives go further
 *   and skip entrances entirely when it is on (see `useMotionSafe`).
 */
export default function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig
        reducedMotion="user"
        transition={{ duration: duration.base, ease: ease.out }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
