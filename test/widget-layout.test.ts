// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_WIDGET_ORDER,
  loadWidgetOrder,
  reorderWidgets,
  resetWidgetOrder,
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
    const original: WidgetId[] = ["activity", "records", "focus", "mentor"];
    const reordered = reorderWidgets(original, 0, 2);
    expect(reordered).toEqual(["records", "focus", "activity", "mentor"]);
  });

  it("reorders widgets properly moving an item backward", () => {
    const original: WidgetId[] = ["activity", "records", "focus", "mentor"];
    const reordered = reorderWidgets(original, 3, 1);
    expect(reordered).toEqual(["activity", "mentor", "records", "focus"]);
  });

  it("returns a copy when indices are out of bounds or identical", () => {
    const original: WidgetId[] = ["activity", "records", "focus", "mentor"];
    expect(reorderWidgets(original, 1, 1)).toEqual(original);
    expect(reorderWidgets(original, -1, 2)).toEqual(original);
    expect(reorderWidgets(original, 0, 10)).toEqual(original);
  });

  it("loads default order when storage is empty", () => {
    const mockStorage = new MockStorage();
    const order = loadWidgetOrder(mockStorage);
    expect(order).toEqual(DEFAULT_WIDGET_ORDER);
  });

  it("saves and reloads custom order from storage", () => {
    const mockStorage = new MockStorage();
    const custom: WidgetId[] = ["focus", "mentor", "activity", "records"];
    saveWidgetOrder(custom, mockStorage);

    const loaded = loadWidgetOrder(mockStorage);
    expect(loaded).toEqual(custom);
  });

  it("resets custom order to defaults and removes storage key", () => {
    const mockStorage = new MockStorage();
    mockStorage.setItem(
      WIDGET_STORAGE_KEY,
      JSON.stringify(["mentor", "focus", "records", "activity"])
    );

    const reset = resetWidgetOrder(mockStorage);
    expect(reset).toEqual(DEFAULT_WIDGET_ORDER);
    expect(mockStorage.getItem(WIDGET_STORAGE_KEY)).toBeNull();
  });
});
