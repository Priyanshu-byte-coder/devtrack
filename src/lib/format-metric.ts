/**
 * Formats a metric with a unit suffix, or "—" when the value is missing.
 * Prevents "undefinedh" / "NaN%" from reaching the UI when an API returns
 * a partial payload.
 */
export function metricWithUnit(value: unknown, unit = ""): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 10) / 10}${unit}`;
}

/** Plain count, or "—" when missing. */
export function metricCount(value: unknown): string | number {
  return typeof value === "number" && Number.isFinite(value) ? value : "—";
}
