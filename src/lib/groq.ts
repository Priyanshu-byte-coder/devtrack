import "server-only";

export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Preferred first, then fallbacks. Groq retires models and keys can be
 * restricted per project; a hard-coded model that the key cannot use made
 * every AI feature fail with `model_not_found`. Override with GROQ_MODEL.
 */
const CANDIDATE_MODELS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "llama-3.1-8b-instant",
];

let workingModel: string | null = null;

type ChatRequest = {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  max_tokens?: number;
  temperature?: number;
};

function candidates(): string[] {
  const preferred = [process.env.GROQ_MODEL, workingModel, ...CANDIDATE_MODELS];
  return [...new Set(preferred.filter((m): m is string => Boolean(m)))];
}

async function isModelUnavailable(res: Response): Promise<boolean> {
  if (res.status !== 404 && res.status !== 400) return false;
  const body = await res.clone().text();
  return /model_not_found|model_decommissioned|does not exist/.test(body);
}

/**
 * POSTs a chat completion, moving to the next candidate model when Groq says
 * the model is unavailable. Returns the final Response (ok or not) so callers
 * keep their own error handling and fallbacks.
 */
export async function groqChatCompletion(
  request: ChatRequest,
  init: { signal?: AbortSignal } = {}
): Promise<Response> {
  let last: Response | null = null;
  for (const model of candidates()) {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      signal: init.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({ model, ...request }),
    });
    if (await isModelUnavailable(res)) {
      last = res;
      if (workingModel === model) workingModel = null;
      continue;
    }
    if (res.ok) workingModel = model;
    return res;
  }
  return last ?? new Response(null, { status: 503 });
}
