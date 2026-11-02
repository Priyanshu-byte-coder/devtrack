import "server-only";
/** An export must never report a failed database read as an empty dataset. */
export function checkedExportQuery<T extends { error?: unknown }>(
  result: T
): T {
  if (result.error) throw new Error("Export data is unavailable");
  return result;
}
