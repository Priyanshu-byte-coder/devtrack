import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const notFound = () =>
  new Response(
    JSON.stringify({
      error: { code: "model_not_found", message: "The model does not exist" },
    }),
    { status: 404 }
  );
const ok = () =>
  new Response(JSON.stringify({ choices: [{ message: { content: "hi" } }] }));
const modelOf = (call: unknown[]) =>
  JSON.parse(String((call[1] as RequestInit).body)).model;

describe("groqChatCompletion", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    delete process.env.GROQ_MODEL;
  });

  it("falls back to the next model when one is unavailable, then remembers it", async () => {
    fetchMock.mockResolvedValueOnce(notFound()).mockResolvedValue(ok());
    const { groqChatCompletion } = await import("@/lib/groq");

    const res = await groqChatCompletion({
      messages: [{ role: "user", content: "x" }],
    });
    expect(res.ok).toBe(true);
    const fallback = modelOf(fetchMock.mock.calls[1]);
    expect(fallback).not.toBe(modelOf(fetchMock.mock.calls[0]));

    await groqChatCompletion({ messages: [{ role: "user", content: "y" }] });
    expect(modelOf(fetchMock.mock.calls[2])).toBe(fallback);
  });

  it("does not retry other failures", async () => {
    fetchMock.mockResolvedValue(new Response("bad key", { status: 401 }));
    const { groqChatCompletion } = await import("@/lib/groq");

    const res = await groqChatCompletion({
      messages: [{ role: "user", content: "x" }],
    });
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tries GROQ_MODEL first", async () => {
    process.env.GROQ_MODEL = "custom-model";
    fetchMock.mockResolvedValue(ok());
    const { groqChatCompletion } = await import("@/lib/groq");

    await groqChatCompletion({ messages: [{ role: "user", content: "x" }] });
    expect(modelOf(fetchMock.mock.calls[0])).toBe("custom-model");
  });
});
