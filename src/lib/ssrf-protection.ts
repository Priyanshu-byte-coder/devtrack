import dns from "dns/promises";
import net from "net";

import { isPublicAddress } from "@/lib/safe-webhook-fetch";

export async function isSafeUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    if (parsed.username || parsed.password) return false;
    const hostname = parsed.hostname;
    let ipToCheck = hostname;
    if (ipToCheck.startsWith("[") && ipToCheck.endsWith("]")) {
      ipToCheck = ipToCheck.slice(1, -1);
    }

    // Block localhost/unspecified/loopback hostnames before DNS resolution
    if (
      hostname === "localhost" ||
      ipToCheck === "0.0.0.0" ||
      ipToCheck === "::1"
    ) {
      return false;
    }

    if (net.isIP(ipToCheck)) {
      return isPublicAddress(ipToCheck);
    }

    const addresses: string[] = [];

    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const lookupResults = await Promise.race([
        dns.lookup(hostname, { all: true }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("DNS lookup timed out")),
            10000
          );
        }),
      ]).finally(() => clearTimeout(timer));
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
      if (!isPublicAddress(addr)) {
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
