import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// next/script renders nothing on the server outside Next; expose its props.
vi.mock("next/script", () => ({
  default: ({ id, children }: { id: string; children: string }) => (
    <script id={id} data-src={children} />
  ),
}));

import ClarityScript from "@/components/analytics/ClarityScript";

describe("ClarityScript", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("renders nothing outside Vercel production", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(renderToStaticMarkup(<ClarityScript />)).toBe("");
  });

  it("only reports from devtrack.live and never shadows window.clarity", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const html = renderToStaticMarkup(<ClarityScript nonce="n" />);
    expect(html).toContain("l.location.hostname !== &quot;devtrack.live&quot;");
    // An element with id="clarity" would become window.clarity and break the queue.
    expect(html).not.toMatch(/id="clarity"/);
  });
});
