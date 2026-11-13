import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const seen = vi.hoisted(() => ({
  props: [] as Array<Record<string, unknown>>,
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown> & { children?: unknown }) => {
    seen.props.push(props);
    return null;
  },
}));

import Link from "@/components/Link";

describe("Link", () => {
  it("doesn't prefetch unless asked", () => {
    seen.props.length = 0;
    renderToStaticMarkup(<Link href="/u/octocat">octocat</Link>);
    expect(seen.props[0]).toMatchObject({
      href: "/u/octocat",
      prefetch: false,
    });
  });

  it("keeps an explicit prefetch", () => {
    seen.props.length = 0;
    renderToStaticMarkup(
      <Link href="/dashboard" prefetch>
        dashboard
      </Link>
    );
    expect(seen.props[0]).toMatchObject({ prefetch: true });
  });
});
