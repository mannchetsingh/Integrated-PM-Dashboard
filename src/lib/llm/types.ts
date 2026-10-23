export type Provider = "anthropic" | "openai";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  provider?: Provider;
  model?: string;
  system: string;
  messages: LLMMessage[];
  maxTokens?: number;
  effort?: Effort;
}

/** Thrown when a provider has no API key configured. */
export class LLMConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMConfigError";
  }
}
