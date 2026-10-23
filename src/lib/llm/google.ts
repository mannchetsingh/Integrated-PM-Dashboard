import { LLMConfigError, type LLMRequest } from "./types";
import { resolveModel } from "./models";

/**
 * Google Gemini over the REST API rather than an SDK — the wire format is small
 * and stable, and it keeps a dependency out of the serverless bundle.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Gemini returns 503 under load far more readily than the other providers. */
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

function getKey() {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new LLMConfigError(
      "GOOGLE_API_KEY is not set. Add it to .env.local (or your Vercel environment " +
        "variables) to use Gemini. Get one at https://aistudio.google.com/apikey.",
    );
  }
  return key;
}

/** Gemini calls the assistant turn "model", and carries the system prompt separately. */
function toBody(req: LLMRequest) {
  return {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: req.messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
    generationConfig: {
      maxOutputTokens: req.maxTokens ?? 16000,
      // Reasoning tokens are drawn from maxOutputTokens on these models. Left
      // unbounded, a long think can consume the whole budget and the response
      // comes back with thought parts and no answer. Cap it so there is always
      // room to actually reply.
      thinkingConfig: { thinkingBudget: 2048 },
    },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(req: LLMRequest, method: "streamGenerateContent" | "generateContent") {
  const model = resolveModel("google", req.model);
  const query = method === "streamGenerateContent" ? "?alt=sse&key=" : "?key=";
  const url = `${BASE}/models/${model}:${method}${query}${getKey()}`;
  const body = JSON.stringify(toBody(req));

  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (response.ok) return response;

    lastError =
      (await response
        .json()
        .then((parsed: { error?: { message?: string } }) => parsed?.error?.message)
        .catch(() => null)) || `Gemini request failed (${response.status})`;

    if (!RETRY_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS) break;

    // Exponential backoff: Gemini's overload errors usually clear in seconds.
    await sleep(attempt * 2000);
  }

  throw new Error(lastError);
}

type Part = { text?: string; thought?: boolean };
type Payload = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
};

/**
 * Pulls answer text out of one chunk. Reasoning arrives as parts flagged
 * `thought` — those are the model working, not its reply, so they're dropped.
 */
function textFrom(payload: Payload): string {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!parts) return "";
  return parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("");
}

/** Turns a silent response into something the user can act on. */
function emptyResponseError(finishReason?: string) {
  if (finishReason === "MAX_TOKENS") {
    return "Gemini hit its output limit before writing an answer. Try a shorter request or a different model.";
  }
  if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
    return "Gemini declined to answer this request.";
  }
  return `Gemini returned no text${finishReason ? ` (finish reason: ${finishReason})` : ""}.`;
}

export async function* streamGoogle(req: LLMRequest): AsyncGenerator<string> {
  const response = await call(req, "streamGenerateContent");
  if (!response.body) throw new Error("Gemini returned an empty stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let produced = false;
  let finishReason: string | undefined;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line — and Gemini sends CRLF, so
    // splitting on "\n\n" matches nothing and silently buffers the whole
    // stream forever. Accept either ending. Keep the trailing partial frame.
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      for (const line of frame.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;

        let payload: Payload;
        try {
          payload = JSON.parse(data) as Payload;
        } catch {
          continue; // A frame split mid-JSON — the next read carries the rest.
        }

        finishReason = payload?.candidates?.[0]?.finishReason ?? finishReason;
        const text = textFrom(payload);
        if (text) {
          produced = true;
          yield text;
        }
      }
    }
  }

  // Never finish silently: a 200 with nothing in it is the worst failure mode,
  // because the UI just shows an empty bubble with no clue why.
  if (!produced) throw new Error(emptyResponseError(finishReason));
}

export async function completeGoogle(req: LLMRequest): Promise<string> {
  const response = await call(req, "generateContent");
  const payload = (await response.json()) as Payload;
  const text = textFrom(payload);

  if (!text) throw new Error(emptyResponseError(payload?.candidates?.[0]?.finishReason));
  return text;
}
