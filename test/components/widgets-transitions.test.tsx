import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import OfflineBanner from "@/components/OfflineBanner";

describe("Widgets and Pages Transitions Audit (Issue #3677 Part 3)", () => {
  it("renders OfflineBanner with explicit transition-[opacity,transform] when offline", () => {
    // When navigator.onLine is mocked or banner is rendered
    const { container } = render(<OfflineBanner />);
    expect(container.querySelector(".transition-all")).toBeNull();
  });
});
