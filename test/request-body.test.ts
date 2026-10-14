// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readBoundedText, RequestBodyTooLargeError } from "@/lib/request-body";
describe("bounded request bodies", () => {
  it("rejects a chunked body as soon as byte limit is crossed", async () => {
    let cancelled = false;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(5));
        controller.enqueue(new Uint8Array(6));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("https://example.com", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(readBoundedText(request, 10)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError
    );
    expect(cancelled).toBe(true);
  });
  it("counts encoded bytes instead of string characters", async () => {
    await expect(
      readBoundedText(
        new Request("https://example.com", { method: "POST", body: "🔥🔥" }),
        7
      )
    ).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });
  it("decodes valid JSON split across chunks", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      body: '{"mode":"hype"}',
    });
    expect(JSON.parse(await readBoundedText(request, 100))).toEqual({
      mode: "hype",
    });
  });
});
