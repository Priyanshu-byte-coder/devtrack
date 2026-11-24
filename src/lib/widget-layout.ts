export const DEFAULT_WIDGET_ORDER = ["activity", "records", "focus", "mentor"] as const;
export type WidgetId = (typeof DEFAULT_WIDGET_ORDER)[number];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  activity: "Activity & Contribution Graph",
  records: "Personal Records & Streaks",
  focus: "Today's Focus & Goals",
  mentor: "AI Mentor Insights",
};

export const WIDGET_STORAGE_KEY = "devtrack:widget-layout:v1";

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
 * Reads widget order from localStorage with validation and fallback to defaults.
 */
export function loadWidgetOrder(storage?: Storage): WidgetId[] {
  const store = storage || (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!store) return [...DEFAULT_WIDGET_ORDER];

  try {
    const raw = store.getItem(WIDGET_STORAGE_KEY);
    if (!raw) return [...DEFAULT_WIDGET_ORDER];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_WIDGET_ORDER];

    // Filter to known valid widget IDs
    const valid = parsed.filter((id): id is WidgetId =>
      DEFAULT_WIDGET_ORDER.includes(id as WidgetId)
    );

    // Ensure all default widgets are present
    for (const def of DEFAULT_WIDGET_ORDER) {
      if (!valid.includes(def)) {
        valid.push(def);
      }
    }

    return valid.length === DEFAULT_WIDGET_ORDER.length ? valid : [...DEFAULT_WIDGET_ORDER];
  } catch {
    return [...DEFAULT_WIDGET_ORDER];
  }
}

/**
 * Persists widget order to localStorage.
 */
export function saveWidgetOrder(order: WidgetId[], storage?: Storage): void {
  const store = storage || (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!store) return;

  try {
    store.setItem(WIDGET_STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Storage quota or privacy restriction
  }
}

/**
 * Resets widget order to default in localStorage.
 */
export function resetWidgetOrder(storage?: Storage): WidgetId[] {
  const store = storage || (typeof window !== "undefined" ? window.localStorage : undefined);
  if (store) {
    try {
      store.removeItem(WIDGET_STORAGE_KEY);
    } catch {
      // Storage unavailable
    }
  }
  return [...DEFAULT_WIDGET_ORDER];
}
