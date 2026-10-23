import { streamAnthropic, completeAnthropic } from "./anthropic";
import { streamOpenAI, completeOpenAI } from "./openai";
import { defaultProvider } from "./models";
import { hasAnthropicCredentials } from "./credentials";
import { LLMConfigError, type LLMRequest, type Provider } from "./types";

export * from "./types";
export * from "./models";

function pick(provider?: Provider): Provider {
  return provider === "openai" || provider === "anthropic" ? provider : defaultProvider();
}

/** Which providers can actually authenticate, for the UI's model picker. */
export function availableProviders(): Provider[] {
  const providers: Provider[] = [];
  // Not just the env var — an `ant auth login` profile counts too.
  if (hasAnthropicCredentials()) providers.push("anthropic");
  if (process.env.OPENAI_API_KEY) providers.push("openai");
  return providers;
}

export function streamLLM(req: LLMRequest): AsyncGenerator<string> {
  const provider = pick(req.provider);
  return provider === "openai" ? streamOpenAI(req) : streamAnthropic(req);
}

export function completeLLM(req: LLMRequest): Promise<string> {
  const provider = pick(req.provider);
  return provider === "openai" ? completeOpenAI(req) : completeAnthropic(req);
}

/**
 * Wraps a text generator in a ReadableStream so a route handler can return it
 * directly. Errors become a readable inline message rather than a dead socket.
 */
export function toResponseStream(generator: AsyncGenerator<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        const message =
          error instanceof LLMConfigError
            ? error.message
            : `The model request failed: ${error instanceof Error ? error.message : "unknown error"}`;
        controller.enqueue(encoder.encode(`\n\n⚠️ ${message}`));
      } finally {
        controller.close();
      }
    },
  });
}
