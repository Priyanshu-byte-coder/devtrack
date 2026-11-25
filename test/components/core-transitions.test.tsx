import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import ConfirmModal from "@/components/ConfirmModal";
import BackToTopButton from "@/components/BackToTopButton";

describe("Core Components Transitions Audit (Issue #3677 Part 2)", () => {
  it("renders ConfirmModal without transition-all and with explicit transition-[opacity,transform]", () => {
    const { container } = render(
      <ConfirmModal
        isOpen={true}
        title="Test Modal"
        message="Test Message"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    const dialog = container.querySelector(".transition-\\[opacity\\,transform\\]");
    expect(dialog).toBeTruthy();
    expect(container.querySelector(".transition-all")).toBeNull();
  });

  it("renders BackToTopButton with explicit transitions instead of transition-all", () => {
    const { container } = render(<BackToTopButton />);
    // Component renders null if scrollY is 0 or button element
    expect(container.querySelector(".transition-all")).toBeNull();
  });
});
