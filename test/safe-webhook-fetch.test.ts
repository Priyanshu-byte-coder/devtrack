// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import dns from "node:dns/promises";
import https from "node:https";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
vi.unmock("@/lib/safe-webhook-fetch");
import { safeWebhookFetch, isPublicAddress } from "@/lib/safe-webhook-fetch";
afterEach(() => vi.restoreAllMocks());
describe("DNS-pinned outbound webhooks", () => {
  it.each([
    "0.1.2.3",
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "192.168.1.1",
    "172.16.0.1",
    "::1",
    "fe80::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "2002:7f00:1::1",
    "64:ff9b::7f00:1",
  ])("blocks reserved address %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    }
  );
  it("rejects any private DNS answer before opening a socket", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValue([
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ] as never);
    const request = vi.spyOn(https, "request");
    await expect(safeWebhookFetch("https://example.com/hook")).rejects.toThrow(
      /Unsafe webhook destination/
    );
    expect(request).not.toHaveBeenCalled();
  });
  it("pins the checked DNS answer and keeps the hostname for TLS and Host", async () => {
    const lookup = vi
      .spyOn(dns, "lookup")
      .mockResolvedValue([{ address: "8.8.8.8", family: 4 }] as never);
    let captured: any;
    let authority: URL | undefined;
    let body = "";
    vi.spyOn(https, "request").mockImplementation(((
      url: URL,
      options: any,
      callback: any
    ) => {
      captured = options;
      authority = url;
      const req = new EventEmitter() as any;
      req.write = (value: string) => {
        body += value;
      };
      req.destroy = (error: Error) => req.emit("error", error);
      req.end = () =>
        queueMicrotask(() => {
          const response = Readable.from([Buffer.from("ok")]) as any;
          response.statusCode = 302;
          response.headers = { location: "http://127.0.0.1/secret" };
          callback(response);
        });
      return req;
    }) as any);
    const response = await safeWebhookFetch("https://example.com/hook", {
      method: "POST",
      headers: { Host: "evil.example" },
      body: "payload",
    });
    expect(authority?.hostname).toBe("example.com");
    expect(captured.headers.host).toBeUndefined();
    expect(body).toBe("payload");
    expect(response.status).toBe(302);
    expect(lookup).toHaveBeenCalledTimes(1);
    const callback = vi.fn();
    captured.lookup("example.com", { all: false }, callback);
    expect(callback).toHaveBeenCalledWith(null, "8.8.8.8", 4);
    expect(captured.signal).toBeInstanceOf(AbortSignal);
    expect(https.request).toHaveBeenCalledTimes(1);
  });
  it.each([
    "https://user:pass@example.com/hook",
    "file:///etc/passwd",
    "http://2130706433/",
  ])("rejects unsafe URL %s", async (url) => {
    await expect(safeWebhookFetch(url)).rejects.toThrow(/Unsafe/);
  });
});
