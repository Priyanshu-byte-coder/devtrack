import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

describe("UI Transitions Audit (Issue #3677 Part 1)", () => {
  it("renders Progress bar with explicit transition-[width]", () => {
    const { container } = render(<Progress value={45} />);
    const bar = container.querySelector(".transition-\\[width\\]");
    expect(bar).toBeTruthy();
    expect(container.querySelector(".transition-all")).toBeNull();
  });

  it("renders TabsTrigger with transition-colors instead of transition-all", () => {
    const { getByRole, container } = render(
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview content</TabsContent>
      </Tabs>
    );

    const trigger = getByRole("tab", { name: "Overview" });
    expect(trigger.className).toContain("transition-colors");
    expect(trigger.className).not.toContain("transition-all");
    expect(container.querySelector(".transition-all")).toBeNull();
  });
});
