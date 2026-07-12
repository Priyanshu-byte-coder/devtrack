import dns from "dns/promises";
import net from "net";

const PRIVATE_RANGES = [
  { start: 0x0a000000, end: 0x0affffff },
  { start: 0xac100000, end: 0xac1fffff },
  { start: 0xc0a80000, end: 0xc0a8ffff },
  { start: 0x7f000000, end: 0x7fffffff },
  { start: 0xa9fe0000, end: 0xa9feffff },
];

function ipToNumber(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) return NaN;
  const numParts = parts.map(Number);
  if (numParts.some((n) => isNaN(n) || n < 0 || n > 255 || !Number.isInteger(n))) return NaN;
  return ((numParts[0] << 24) | (numParts[1] << 16) | (numParts[2] << 8) | numParts[3]) >>> 0;
}

function isPrivateIP(ip: string): boolean {
  ip = ip.toLowerCase();

  // Extract IPv4 from IPv6-mapped IPv4 address
  if (ip.startsWith("::ffff:")) {
    const ipv4Part = ip.slice(7);
    if (ipv4Part.includes(".")) {
      ip = ipv4Part;
    } else {
      // Block non-standard encodings of mapped IPv4
      return true;
    }
  }

  // IPv6 private/loopback checks
  if (
    ip === "::1" ||
    ip === "::" ||
    ip.startsWith("fe80:") ||
    ip.startsWith("fc00:") ||
    ip.startsWith("fd00:")
  ) {
    return true;
  }

  if (ip.includes(":")) {
    return false; // Public IPv6
  }

  const num = ipToNumber(ip);
  if (isNaN(num)) return true; // Block invalid formats

  return PRIVATE_RANGES.some(({ start, end }) => num >= start && num <= end);
}

/**
 * @deprecated for outbound requests — DNS is re-resolved by the caller's
 * fetch(), reopening the TOCTOU gap. Use resolveAndValidateUrl + pinnedFetch
 * from ./pinned-fetch for any code path that also performs the network request.
 */
export async function isSafeUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname;
    let ipToCheck = hostname;
    if (ipToCheck.startsWith("[") && ipToCheck.endsWith("]")) {
      ipToCheck = ipToCheck.slice(1, -1);
    }

    // Block localhost/unspecified/loopback hostnames before DNS resolution
    if (hostname === "localhost" || ipToCheck === "0.0.0.0" || ipToCheck === "::1") {
      return false;
    }

    if (net.isIP(ipToCheck)) {
      return !isPrivateIP(ipToCheck);
    }

    const addresses: string[] = [];

    try {
      const lookupResults = await dns.lookup(hostname, { all: true });
      if (Array.isArray(lookupResults)) {
        addresses.push(...lookupResults.map((r) => r.address));
      }
    } catch {
      return false;
    }

    if (addresses.length === 0) {
      return false;
    }

    for (const addr of addresses) {
      if (isPrivateIP(addr)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export function validateUrlBasic(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export interface PinnedUrlResult {
  safe: boolean;
  pinnedIp?: string;
  hostname?: string;
  protocol?: string;
  reason?: string;
}

/**
 * Resolves DNS ONCE, validates every returned IP, returns the pinned IP.
 * Callers must use pinnedIp for the actual request — never re-resolve.
 */
export async function resolveAndValidateUrl(url: string): Promise<PinnedUrlResult> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return { safe: false, reason: "Invalid URL" }; }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: "Unsupported protocol" };
  }

  const hostname = parsed.hostname;
  let ipToCheck = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1) : hostname;

  if (hostname === "localhost" || ipToCheck === "0.0.0.0" || ipToCheck === "::1") {
    return { safe: false, reason: "Blocked hostname" };
  }

  // Literal IP — validate directly, no DNS needed
  if (net.isIP(ipToCheck)) {
    return isPrivateIP(ipToCheck)
      ? { safe: false, reason: "Private IP literal" }
      : { safe: true, pinnedIp: ipToCheck, hostname, protocol: parsed.protocol };
  }

  let addresses: string[] = [];
  try {
    const results = await dns.lookup(hostname, { all: true });
    addresses = results.map((r) => r.address);
  } catch { return { safe: false, reason: "DNS resolution failed" }; }

  if (!addresses.length) return { safe: false, reason: "No addresses resolved" };

  // Reject if ANY address is private (mixed public+private = rebinding red flag)
  for (const addr of addresses) {
    if (isPrivateIP(addr)) return { safe: false, reason: "Resolved to private address" };
  }

  return { safe: true, pinnedIp: addresses[0], hostname, protocol: parsed.protocol };
}