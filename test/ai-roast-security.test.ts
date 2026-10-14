import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  quota: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("@/lib/server-session", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/ai-quota", () => ({ checkAiQuota: mocks.quota }));
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mocks.generate };
    }
  },
}));
import { POST } from "@/app/api/ai/roast/route";
const request = (body: unknown) =>
  new Request("http://localhost/api/ai/roast", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GEMINI_API_KEY", "dummy");
  mocks.session.mockResolvedValue({ githubId: "101" });
  mocks.quota.mockResolvedValue(null);
  mocks.generate.mockResolvedValue({ response: { text: () => "Hello" } });
});
afterEach(() => vi.unstubAllEnvs());
it("rejects anonymous generation before touching the provider or quota", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await POST(request({ mode: "hype", stats: {} }))).status).toBe(401);
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(mocks.quota).not.toHaveBeenCalled();
});
it("bounds streamed payloads before consuming quota", async () => {
  expect(
    (await POST(request({ mode: "hype", stats: { x: "x".repeat(9000) } })))
      .status
  ).toBe(413);
  expect(mocks.quota).not.toHaveBeenCalled();
});
it.each([
  { mode: "hype", stats: { commits: -1 } },
  { mode: "invalid", stats: {} },
  { mode: "hype", stats: [] },
  { mode: "hype", stats: { languages: ["x".repeat(81)] } },
])("rejects invalid input %#", async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("returns quota cooldown without calling the paid provider", async () => {
  mocks.quota.mockResolvedValue(
    Response.json(
      { error: "quota" },
      { status: 429, headers: { "Retry-After": "3600" } }
    )
  );
  const response = await POST(request({ mode: "hype", stats: { commits: 2 } }));
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("3600");
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("requires a configured provider", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  expect((await POST(request({ mode: "hype", stats: {} }))).status).toBe(503);
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("sets a provider deadline for authorized input", async () => {
  expect(
    (await POST(request({ mode: "hype", stats: { commits: 2 } }))).status
  ).toBe(200);
  expect(mocks.quota).toHaveBeenCalledWith("101");
  expect(mocks.generate).toHaveBeenCalledWith(expect.any(String), {
    timeout: 15000,
  });
});
