import "server-only";
import dns from "node:dns/promises";
import net from "node:net";
import http from "node:http";
import https from "node:https";

const blockedIPv4 = new net.BlockList();
const blockedIPv6 = new net.BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blockedIPv4.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
  ["2001::", 32],
  ["::ffff:0:0", 96],
  ["::", 96],
  ["64:ff9b:1::", 48],
  ["64:ff9b::", 96],
  ["2002::", 16],
] as const)
  blockedIPv6.addSubnet(network, prefix, "ipv6");

export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return !blockedIPv4.check(address, "ipv4");
  if (family === 6) return !blockedIPv6.check(address, "ipv6");
  return false;
}

/** Resolve once, validate every answer and pin that answer to the TCP connection. */
export async function safeWebhookFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = new URL(input);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Unsafe webhook URL");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const timeoutMs = 10_000;
  let lookupTimer: ReturnType<typeof setTimeout> | undefined;
  const addresses = net.isIP(hostname)
    ? [{ address: hostname, family: net.isIP(hostname) }]
    : await Promise.race([
        dns.lookup(hostname, { all: true }),
        new Promise<never>((_, reject) => {
          lookupTimer = setTimeout(
            () => reject(new Error("Webhook DNS timeout")),
            timeoutMs
          );
        }),
      ]).finally(() => clearTimeout(lookupTimer));
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  )
    throw new Error("Unsafe webhook destination");
  const pinned = addresses[0];
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  // Never let callers override the validated authority.
  delete headers.host;
  return new Promise<Response>((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method: init.method ?? "POST",
        headers,
        agent: false,
        signal: init.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)])
          : AbortSignal.timeout(timeoutMs),
        lookup: (_hostname, options, callback) => {
          if (options.all)
            callback(null, [
              { address: pinned.address, family: pinned.family },
            ]);
          else callback(null, pinned.address, pinned.family);
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 64 * 1024) {
            request.destroy(new Error("Webhook response too large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          const responseHeaders = new Headers();
          for (const [name, value] of Object.entries(response.headers))
            if (value !== undefined)
              responseHeaders.set(
                name,
                Array.isArray(value) ? value.join(", ") : value
              );
          const status = response.statusCode ?? 502;
          resolve(
            new Response(
              [204, 205, 304].includes(status) ? null : Buffer.concat(chunks),
              { status, headers: responseHeaders }
            )
          );
        });
      }
    );
    request.on("error", reject);
    if (typeof init.body === "string") request.write(init.body);
    else if (init.body != null) {
      request.destroy(new Error("Webhook body must be a string"));
      return;
    }
    request.end();
  });
}
