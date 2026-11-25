export const DEFAULT_MAIN_WIDGETS = ["activity", "records"] as const;
export const DEFAULT_SIDE_WIDGETS = ["focus", "mentor"] as const;

export type MainWidgetId = (typeof DEFAULT_MAIN_WIDGETS)[number];
export type SideWidgetId = (typeof DEFAULT_SIDE_WIDGETS)[number];
export type WidgetId = MainWidgetId | SideWidgetId;

export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  ...DEFAULT_MAIN_WIDGETS,
  ...DEFAULT_SIDE_WIDGETS,
];

export interface DashboardLayout {
  main: WidgetId[];
  side: WidgetId[];
}

export const DEFAULT_LAYOUT: DashboardLayout = {
  main: [...DEFAULT_MAIN_WIDGETS],
  side: [...DEFAULT_SIDE_WIDGETS],
};

export const WIDGET_LABELS: Record<WidgetId, string> = {
  activity: "Activity & Contribution Graph",
  records: "Personal Records & Streaks",
  focus: "Today's Focus & Goals",
  mentor: "AI Mentor Insights",
};

export const WIDGET_STORAGE_KEY = "devtrack:widget-layout:v2";
export const LEGACY_STORAGE_KEY = "devtrack:widget-layout:v1";

/**
 * Reorders a list of widget IDs by moving the element from startIndex to endIndex.
 */
export function reorderWidgets(
  list: WidgetId[],
  startIndex: number,
  endIndex: number
): WidgetId[] {
  if (
    startIndex < 0 ||
    startIndex >= list.length ||
    endIndex < 0 ||
    endIndex >= list.length ||
    startIndex === endIndex
  ) {
    return [...list];
  }

  const result = [...list];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

/**
 * Moves a widget up or down in its column.
 */
export function moveWidget(
  list: WidgetId[],
  index: number,
  direction: "up" | "down"
): WidgetId[] {
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  return reorderWidgets(list, index, targetIndex);
}

function reconcileColumn(
  saved: unknown[],
  defaults: readonly WidgetId[]
): WidgetId[] {
  // Ignore unknown ids
  const valid = (Array.isArray(saved) ? saved : []).filter(
    (id): id is WidgetId => defaults.includes(id as WidgetId)
  );
  const result: WidgetId[] = [];
  const seen = new Set<WidgetId>();

  for (const id of valid) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }

  // Append new default widgets at the end
  for (const def of defaults) {
    if (!seen.has(def)) {
      seen.add(def);
      result.push(def);
    }
  }

  return result;
}

/**
 * Reads layout from localStorage with validation, surviving widget additions/removals.
 */
export function loadWidgetLayout(storage?: Storage): DashboardLayout {
  const store =
    storage || (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!store) return { ...DEFAULT_LAYOUT };

  try {
    const raw = store.getItem(WIDGET_STORAGE_KEY) || store.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT };

    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const main = reconcileColumn(parsed.main, DEFAULT_MAIN_WIDGETS);
      const side = reconcileColumn(parsed.side, DEFAULT_SIDE_WIDGETS);
      return { main, side };
    }

    if (Array.isArray(parsed)) {
      const main = reconcileColumn(
        parsed.filter((id) => DEFAULT_MAIN_WIDGETS.includes(id as any)),
        DEFAULT_MAIN_WIDGETS
      );
      const side = reconcileColumn(
        parsed.filter((id) => DEFAULT_SIDE_WIDGETS.includes(id as any)),
        DEFAULT_SIDE_WIDGETS
      );
      return { main, side };
    }

    return { ...DEFAULT_LAYOUT };
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

/**
 * Backwards compatibility helper returning flat array of widgets.
 */
export function loadWidgetOrder(storage?: Storage): WidgetId[] {
  const layout = loadWidgetLayout(storage);
  return [...layout.main, ...layout.side];
}

/**
 * Persists widget layout to localStorage.
 */
export function saveWidgetLayout(layout: DashboardLayout, storage?: Storage): void {
  const store =
    storage || (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!store) return;

  try {
    store.setItem(WIDGET_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage quota or privacy restriction
  }
}

/**
 * Backwards compatibility helper saving flat array.
 */
export function saveWidgetOrder(order: WidgetId[], storage?: Storage): void {
  const main = reconcileColumn(
    order.filter((id) => DEFAULT_MAIN_WIDGETS.includes(id as any)),
    DEFAULT_MAIN_WIDGETS
  );
  const side = reconcileColumn(
    order.filter((id) => DEFAULT_SIDE_WIDGETS.includes(id as any)),
    DEFAULT_SIDE_WIDGETS
  );
  saveWidgetLayout({ main, side }, storage);
}

/**
 * Resets widget layout to default in localStorage.
 */
export function resetWidgetLayout(storage?: Storage): DashboardLayout {
  const store =
    storage || (typeof window !== "undefined" ? window.localStorage : undefined);
  if (store) {
    try {
      store.removeItem(WIDGET_STORAGE_KEY);
      store.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Storage unavailable
    }
  }
  return { ...DEFAULT_LAYOUT };
}

export function resetWidgetOrder(storage?: Storage): WidgetId[] {
  resetWidgetLayout(storage);
  return [...DEFAULT_WIDGET_ORDER];
}
