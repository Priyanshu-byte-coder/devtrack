// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUT,
  DEFAULT_MAIN_WIDGETS,
  DEFAULT_SIDE_WIDGETS,
  DEFAULT_WIDGET_ORDER,
  loadWidgetLayout,
  loadWidgetOrder,
  moveWidget,
  reorderWidgets,
  resetWidgetLayout,
  resetWidgetOrder,
  saveWidgetLayout,
  saveWidgetOrder,
  WIDGET_STORAGE_KEY,
  WidgetId,
} from "../src/lib/widget-layout";

class MockStorage implements Storage {
  private store: Record<string, string> = {};
  get length() {
    return Object.keys(this.store).length;
  }
  clear() {
    this.store = {};
  }
  getItem(key: string) {
    return this.store[key] || null;
  }
  key(index: number) {
    return Object.keys(this.store)[index] || null;
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  setItem(key: string, value: string) {
    this.store[key] = value;
  }
}

describe("widget-layout utilities (Issue #94)", () => {
  it("reorders widgets properly moving an item forward", () => {
    const original: WidgetId[] = ["activity", "records"];
    const reordered = reorderWidgets(original, 0, 1);
    expect(reordered).toEqual(["records", "activity"]);
  });

  it("moves widget up and down via moveWidget", () => {
    const original: WidgetId[] = ["activity", "records"];
    const movedDown = moveWidget(original, 0, "down");
    expect(movedDown).toEqual(["records", "activity"]);

    const movedUp = moveWidget(movedDown, 1, "up");
    expect(movedUp).toEqual(["activity", "records"]);
  });

  it("returns a copy when indices are out of bounds or identical", () => {
    const original: WidgetId[] = ["activity", "records"];
    expect(reorderWidgets(original, 1, 1)).toEqual(original);
    expect(reorderWidgets(original, -1, 2)).toEqual(original);
    expect(reorderWidgets(original, 0, 10)).toEqual(original);
  });

  it("loads default layout when storage is empty", () => {
    const mockStorage = new MockStorage();
    const layout = loadWidgetLayout(mockStorage);
    expect(layout).toEqual(DEFAULT_LAYOUT);
    expect(layout.main).toEqual([...DEFAULT_MAIN_WIDGETS]);
    expect(layout.side).toEqual([...DEFAULT_SIDE_WIDGETS]);
  });

  it("ignores unknown widget IDs in saved layouts", () => {
    const mockStorage = new MockStorage();
    mockStorage.setItem(
      WIDGET_STORAGE_KEY,
      JSON.stringify({
        main: ["unknown-widget-1", "records", "unknown-widget-2"],
        side: ["unknown-widget-3", "mentor"],
      })
    );

    const loaded = loadWidgetLayout(mockStorage);
    // Unknown IDs ignored, missing default IDs appended at end
    expect(loaded.main).toEqual(["records", "activity"]);
    expect(loaded.side).toEqual(["mentor", "focus"]);
  });

  it("appends new default widgets when omitted from saved layout", () => {
    const mockStorage = new MockStorage();
    mockStorage.setItem(
      WIDGET_STORAGE_KEY,
      JSON.stringify({
        main: ["records"], // missing "activity"
        side: ["mentor"], // missing "focus"
      })
    );

    const loaded = loadWidgetLayout(mockStorage);
    expect(loaded.main).toEqual(["records", "activity"]);
    expect(loaded.side).toEqual(["mentor", "focus"]);
  });

  it("saves and reloads custom layout from storage", () => {
    const mockStorage = new MockStorage();
    const custom = {
      main: ["records", "activity"] as WidgetId[],
      side: ["mentor", "focus"] as WidgetId[],
    };
    saveWidgetLayout(custom, mockStorage);

    const loaded = loadWidgetLayout(mockStorage);
    expect(loaded).toEqual(custom);
  });

  it("resets custom layout to defaults and removes storage keys", () => {
    const mockStorage = new MockStorage();
    mockStorage.setItem(
      WIDGET_STORAGE_KEY,
      JSON.stringify({
        main: ["records", "activity"],
        side: ["mentor", "focus"],
      })
    );

    const reset = resetWidgetLayout(mockStorage);
    expect(reset).toEqual(DEFAULT_LAYOUT);
    expect(mockStorage.getItem(WIDGET_STORAGE_KEY)).toBeNull();
  });

  it("maintains backwards compatibility with flat array storage", () => {
    const mockStorage = new MockStorage();
    mockStorage.setItem(
      WIDGET_STORAGE_KEY,
      JSON.stringify(["records", "mentor", "activity", "focus"])
    );

    const layout = loadWidgetLayout(mockStorage);
    expect(layout.main).toEqual(["records", "activity"]);
    expect(layout.side).toEqual(["mentor", "focus"]);
  });
});
