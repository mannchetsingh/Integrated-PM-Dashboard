import Anthropic from "@anthropic-ai/sdk";
import { LLMConfigError, type Effort, type LLMRequest } from "./types";
import { resolveModel, supportsReasoning } from "./models";
import { hasAnthropicCredentials } from "./credentials";

let cached: Anthropic | null = null;

function getClient() {
  if (!hasAnthropicCredentials()) {
    throw new LLMConfigError(
      "No Anthropic credentials found. Either set ANTHROPIC_API_KEY in .env.local " +
        "(and in your Vercel environment variables), or run `ant auth login` to sign in " +
        "with your Anthropic account for local development.",
    );
  }

  // Construct it bare: the SDK resolves ANTHROPIC_API_KEY, then
  // ANTHROPIC_AUTH_TOKEN, then the OAuth profile from `ant auth login`.
  // Passing an explicit apiKey here would break the profile path.
  cached ??= new Anthropic();
  return cached;
}

/**
 * Adaptive thinking and `output_config.effort` only apply to the current
 * Opus/Sonnet generation. Haiku 4.5 returns an error for `effort` and uses the
 * older budget_tokens shape, so send neither — it answers directly, which is
 * what you want from the "quick lookups" option anyway.
 */
function reasoningParams(model: string, effort: LLMRequest["effort"], fallback: Effort) {
  if (!supportsReasoning("anthropic", model)) return {};
  return {
    thinking: { type: "adaptive" as const },
    output_config: { effort: effort ?? fallback },
  };
}

export async function* streamAnthropic(req: LLMRequest): AsyncGenerator<string> {
  const model = resolveModel("anthropic", req.model);

  const stream = getClient().messages.stream({
    model,
    max_tokens: req.maxTokens ?? 16000,
    system: req.system,
    messages: req.messages,
    ...reasoningParams(model, req.effort, "medium"),
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }

  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    yield "\n\n_(The model declined to answer this request.)_";
  }
}

export async function completeAnthropic(req: LLMRequest): Promise<string> {
  const model = resolveModel("anthropic", req.model);

  const stream = getClient().messages.stream({
    model,
    max_tokens: req.maxTokens ?? 16000,
    system: req.system,
    messages: req.messages,
    ...reasoningParams(model, req.effort, "high"),
  });

  const message = await stream.finalMessage();
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}
