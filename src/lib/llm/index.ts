import { streamAnthropic, completeAnthropic } from "./anthropic";
import { streamOpenAI, completeOpenAI } from "./openai";
import { streamGoogle, completeGoogle } from "./google";
import { defaultProvider } from "./models";
import { hasAnthropicCredentials } from "./credentials";
import { LLMConfigError, type LLMRequest, type Provider } from "./types";

export * from "./types";
export * from "./models";

const PROVIDERS: Provider[] = ["anthropic", "openai", "google"];

function pick(provider?: Provider): Provider {
  return provider && PROVIDERS.includes(provider) ? provider : defaultProvider();
}

export const hasGoogleCredentials = () =>
  !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);

/** Which providers can actually authenticate, for the UI's model picker. */
export function availableProviders(): Provider[] {
  const providers: Provider[] = [];
  // Not just the env var — an `ant auth login` profile counts too.
  if (hasAnthropicCredentials()) providers.push("anthropic");
  if (process.env.OPENAI_API_KEY) providers.push("openai");
  if (hasGoogleCredentials()) providers.push("google");
  return providers;
}

export function streamLLM(req: LLMRequest): AsyncGenerator<string> {
  switch (pick(req.provider)) {
    case "openai":
      return streamOpenAI(req);
    case "google":
      return streamGoogle(req);
    default:
      return streamAnthropic(req);
  }
}

export function completeLLM(req: LLMRequest): Promise<string> {
  switch (pick(req.provider)) {
    case "openai":
      return completeOpenAI(req);
    case "google":
      return completeGoogle(req);
    default:
      return completeAnthropic(req);
  }
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
