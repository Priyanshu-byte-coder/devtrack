const PLACEHOLDER_PATTERNS = [
  /^your[-_]/i,
  /^changeme$/i,
  /^placeholder$/i,
  /^xxx+$/i,
  /^todo$/i,
];

function isUnset(value: string | undefined): boolean {
  if (!value || value.trim() === "") return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function logAuthConfigStatus(): void {
  const issues: string[] = [];

  if (isUnset(process.env.GITHUB_ID)) {
    issues.push("GITHUB_ID is unset — GitHub sign-in will fail");
  }
  if (isUnset(process.env.GITHUB_SECRET)) {
    issues.push("GITHUB_SECRET is unset — GitHub sign-in will fail");
  }
  if (isUnset(process.env.NEXTAUTH_SECRET)) {
    issues.push("NEXTAUTH_SECRET is unset — sessions cannot be signed");
  }
  if (isUnset(process.env.NEXTAUTH_URL)) {
    issues.push(
      "NEXTAUTH_URL is unset — OAuth callbacks may redirect incorrectly"
    );
  } else if (process.env.NEXTAUTH_URL?.endsWith("/")) {
    issues.push(
      "NEXTAUTH_URL has a trailing slash — remove it (e.g. https://example.com)"
    );
  }

  if (issues.length > 0) {
    console.warn(
      "[auth] Self-hosting configuration issues:\n  - " + issues.join("\n  - ")
    );
  } else if (process.env.AUTH_DEBUG === "true") {
    console.info("[auth] GitHub OAuth and NextAuth env vars look configured");
  }
}

logAuthConfigStatus();

export const authDebugEnabled = process.env.AUTH_DEBUG === "true";

export const nextAuthLogger = {
  error(code: string, metadata: unknown) {
    console.error("[nextauth]", code, metadata);
  },
  warn(code: string) {
    console.warn("[nextauth]", code);
  },
  debug(code: string, metadata: unknown) {
    if (authDebugEnabled) {
      console.debug("[nextauth]", code, metadata);
    }
  },
};
