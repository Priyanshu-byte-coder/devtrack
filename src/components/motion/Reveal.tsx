"use client";

/**
 * Scroll-triggered entrances.
 *
 * Adapted from Motion Primitives' InView (MIT, (c) 2024 ibelick,
 * https://github.com/ibelick/motion-primitives). Changes: uses the lazy `m`
 * elements and adds a staggered group variant.
 *
 * Revealed elements carry `data-reveal`. A CSS rule shows them at rest when
 * the user prefers reduced motion (globals.css) or JavaScript never runs (the
 * root layout's <noscript>). Doing it in CSS rather than branching on
 * `useReducedMotion()` keeps server and client markup identical, since the
 * server cannot know the visitor's motion setting.
 */

import { m, type Variants } from "motion/react";
import type { ReactNode } from "react";
import {
  duration,
  ease,
  entranceOffset,
  stagger as staggerTokens,
} from "@/lib/motion";

const elements = {
  div: m.div,
  section: m.section,
  ul: m.ul,
  ol: m.ol,
  li: m.li,
  span: m.span,
} as const;

type RevealElement = keyof typeof elements;

// The delay lives inside the variant: a variant's own transition overrides
// the element's `transition` prop, so a delay passed there would be ignored.
function itemVariants(y: number, delay = 0): Variants {
  return {
    hidden: { opacity: 0, y },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: duration.slow, ease: ease.out, delay },
    },
  };
}

interface RevealProps {
  children: ReactNode;
  as?: RevealElement;
  className?: string;
  /** Seconds before this element starts, on top of any group stagger. */
  delay?: number;
  /** Vertical travel in px. 0 gives a pure fade. */
  y?: number;
  /** Fraction of the element that must be on screen before it plays. */
  amount?: number;
  id?: string;
}

/** A single element that fades and rises into place the first time it scrolls into view. */
export function Reveal({
  children,
  as = "div",
  className,
  delay = 0,
  y = entranceOffset,
  amount = 0.2,
  id,
}: RevealProps) {
  const Element = elements[as];
  const variants = itemVariants(y, delay);

  return (
    <Element
      id={id}
      data-reveal=""
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
    >
      {children}
    </Element>
  );
}

interface RevealGroupProps {
  children: ReactNode;
  as?: RevealElement;
  className?: string;
  /** Delay between children, in seconds. */
  stagger?: number;
  delay?: number;
  amount?: number;
  "aria-label"?: string;
  id?: string;
}

/**
 * A container whose `RevealItem` children enter one after another.
 * Children animate only through the group, so put RevealItem directly inside.
 */
export function RevealGroup({
  children,
  as = "div",
  className,
  stagger = staggerTokens.base,
  delay = 0,
  amount = 0.1,
  "aria-label": ariaLabel,
  id,
}: RevealGroupProps) {
  const Element = elements[as];

  return (
    <Element
      id={id}
      className={className}
      aria-label={ariaLabel}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: stagger, delayChildren: delay },
        },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
    >
      {children}
    </Element>
  );
}

interface RevealItemProps {
  children: ReactNode;
  as?: RevealElement;
  className?: string;
  y?: number;
}

/** One staggered child of a `RevealGroup`. */
export function RevealItem({
  children,
  as = "div",
  className,
  y = entranceOffset,
}: RevealItemProps) {
  const Element = elements[as];
  return (
    <Element data-reveal="" className={className} variants={itemVariants(y)}>
      {children}
    </Element>
  );
}
