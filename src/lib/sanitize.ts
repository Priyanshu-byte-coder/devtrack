export function stripHtml(value: string): string {
let text = value.normalize("NFKC");
  // Decode entities first so entity-encoded tags are also stripped below
  text = text.replace(/&(?:lt|gt|amp|quot|#x27|#39);/gi, (m) => {
    const map: Record<string, string> = {
      "&lt;": "<",
      "&gt;": ">",
      "&amp;": "&",
      "&quot;": '"',
      "&#x27;": "'",
      "&#39;": "'",
    };
    return map[m] ?? m;
  });
  // Strip tags iteratively until stable — prevents nested/split tag bypass
  let prev: string;
  do {
    prev = text;
    text = text.replace(/<[^>]*>/g, "");
  } while (text !== prev);
  return text.trim();
}

export interface ValidationResult {
  ok: boolean;
  value: string;
  error?: string;
}

export function validateTextInput(
  raw: unknown,
  field: string,
  maxLen = 200
): ValidationResult {
  if (typeof raw !== "string") {
    return { ok: false, value: "", error: `${field} must be a string` };
  }
  const stripped = stripHtml(raw);
  if (stripped.length === 0) {
    return { ok: false, value: "", error: `${field} must not be empty` };
  }
  if (stripped.length > maxLen) {
    return { ok: false, value: "", error: `${field} must be ${maxLen} characters or fewer` };
  }
  return { ok: true, value: stripped };
}