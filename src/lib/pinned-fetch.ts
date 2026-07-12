import http from "http";
import https from "https";
import { resolveAndValidateUrl } from "./ssrf-protection";

export interface PinnedFetchOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface PinnedFetchResult {
  ok: boolean;
  status?: number;
  body?: string;
  error?: string;
}

/**
 * Validates + fetches in ONE DNS resolution. Connects directly to the pinned
 * IP so DNS cannot be re-resolved between check and request (no TOCTOU).
 * Never follows redirects — each hop would reopen the rebinding gap.
 */
export async function pinnedFetch(
  url: string,
  options: PinnedFetchOptions
): Promise<PinnedFetchResult> {
  const v = await resolveAndValidateUrl(url);
  if (!v.safe || !v.pinnedIp || !v.hostname || !v.protocol) {
    return { ok: false, error: v.reason ?? "URL failed SSRF validation" };
  }

  const parsed = new URL(url);
  const transport = v.protocol === "https:" ? https : http;

  return new Promise((resolve) => {
    const req = transport.request(
      {
        protocol: v.protocol,
        hostname: v.pinnedIp,          // ← connect to PINNED IP, not hostname
        servername: v.protocol === "https:" ? v.hostname : undefined, // TLS SNI
        port: parsed.port || (v.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: options.method,
        headers: { ...options.headers, Host: v.hostname },
        timeout: options.timeoutMs ?? 10_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({
          ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
          status: res.statusCode,
          body: Buffer.concat(chunks).toString("utf8"),
        }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", (err) => resolve({ ok: false, error: err.message }));
    if (options.body) req.write(options.body);
    req.end();
  });
}