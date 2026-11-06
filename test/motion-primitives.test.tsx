/**
 * Motion primitives must not cost us content: crawlers and no-JS visitors
 * read the server HTML, so numbers have to be real there, and anything that
 * starts hidden needs the hook the CSS fallback keys on.
 */

import { renderToString } from "react-dom/server";
import { LazyMotion, domAnimation } from "motion/react";
import { describe, expect, it } from "vitest";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";

function withMotion(node: React.ReactNode) {
  return (
    <LazyMotion features={domAnimation} strict>
      {node}
    </LazyMotion>
  );
}

describe("AnimatedNumber", () => {
  it("server-renders the real value, not zero", () => {
    const html = renderToString(withMotion(<AnimatedNumber value={1558} />));
    expect(html).toContain("1,558");
  });

  it("formats with a fixed locale so server and browser markup match", () => {
    const html = renderToString(withMotion(<AnimatedNumber value={1234567} />));
    expect(html).toContain("1,234,567");
  });

  it("accepts a custom formatter", () => {
    const html = renderToString(
      withMotion(<AnimatedNumber value={42} format={(n) => `${n} days`} />)
    );
    expect(html).toContain("42 days");
  });

  it("uses tabular figures so digits do not jitter while counting", () => {
    const html = renderToString(withMotion(<AnimatedNumber value={7} />));
    expect(html).toMatch(/<span[^>]*class="[^"]*tabular-nums/);
  });
});

describe("Reveal", () => {
  it("marks revealed elements for the reduced-motion and no-JS fallback", () => {
    const html = renderToString(withMotion(<Reveal>hello</Reveal>));
    expect(html).toContain("data-reveal");
    expect(html).toContain("hello");
  });

  it("renders the requested element", () => {
    const html = renderToString(
      withMotion(
        <ul>
          <Reveal as="li">row</Reveal>
        </ul>
      )
    );
    expect(html).toMatch(/<li[^>]*data-reveal/);
  });

  it("marks each staggered group item", () => {
    const html = renderToString(
      withMotion(
        <RevealGroup as="ul">
          <RevealItem as="li">a</RevealItem>
          <RevealItem as="li">b</RevealItem>
        </RevealGroup>
      )
    );
    expect(html.match(/data-reveal/g)).toHaveLength(2);
  });
});
