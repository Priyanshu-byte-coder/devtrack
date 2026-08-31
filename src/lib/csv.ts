/**
 * Minimal CSV serialisation utilities.
 *
 * Rules applied:
 *   - Values that contain a comma, double-quote, or newline are wrapped in
 *     double-quotes.
 *   - Any double-quote inside a value is escaped by doubling it ("").
 *   - null / undefined render as an empty cell.
 *   - Numbers and booleans are coerced to string without quoting.
 */

/** Escape and optionally quote a single CSV cell value. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[,"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serialise an array of objects to CSV text.
 *
 * The column order is determined by the keys of the first row.  Subsequent
 * rows that are missing a key emit an empty cell; extra keys are ignored so
 * the header is stable.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const lines: string[] = [headers.map(csvCell).join(",")];

  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(","));
  }

  return lines.join("\n");
}
