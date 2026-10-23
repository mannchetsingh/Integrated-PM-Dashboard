import OpenAI from "openai";
import { LLMConfigError, type LLMRequest } from "./types";
import { resolveModel } from "./models";

let cached: OpenAI | null = null;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new LLMConfigError(
      "OPENAI_API_KEY is not set. Add it to .env.local (or your Vercel environment variables) to use OpenAI.",
    );
  }
  cached ??= new OpenAI({ apiKey });
  return cached;
}

function toMessages(req: LLMRequest) {
  return [
    { role: "system" as const, content: req.system },
    ...req.messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}

export async function* streamOpenAI(req: LLMRequest): AsyncGenerator<string> {
  const stream = await getClient().chat.completions.create({
    model: resolveModel("openai", req.model),
    max_completion_tokens: req.maxTokens ?? 16000,
    messages: toMessages(req),
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

export async function completeOpenAI(req: LLMRequest): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: resolveModel("openai", req.model),
    max_completion_tokens: req.maxTokens ?? 16000,
    messages: toMessages(req),
  });

  return response.choices[0]?.message?.content ?? "";
}
