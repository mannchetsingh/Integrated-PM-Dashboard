import type { Provider } from "./types";

export interface ModelOption {
  id: string;
  label: string;
  hint: string;
  /**
   * Takes adaptive thinking and `output_config.effort`. Haiku 4.5 takes
   * neither — it rejects `effort` outright — so those fields must be omitted
   * for it rather than sent and ignored.
   */
  reasoning: boolean;
}

/**
 * Edit these lists freely — they only drive the model picker in the UI and the
 * default used when a request doesn't name one.
 */
export const MODELS: Record<Provider, ModelOption[]> = {
  anthropic: [
    {
      id: "claude-opus-5",
      label: "Claude Opus 5",
      hint: "Best reasoning and writing",
      reasoning: true,
    },
    {
      id: "claude-sonnet-5",
      label: "Claude Sonnet 5",
      hint: "Faster, cheaper",
      reasoning: true,
    },
    {
      id: "claude-haiku-4-5",
      label: "Claude Haiku 4.5",
      hint: "Quick lookups",
      reasoning: false,
    },
  ],
  openai: [
    { id: "gpt-5", label: "GPT-5", hint: "Most capable", reasoning: true },
    { id: "gpt-5-mini", label: "GPT-5 mini", hint: "Faster, cheaper", reasoning: true },
    { id: "gpt-4.1", label: "GPT-4.1", hint: "Previous generation", reasoning: false },
  ],
};

/** Whether this model accepts adaptive thinking + effort. */
export function supportsReasoning(provider: Provider, model: string) {
  return MODELS[provider].find((entry) => entry.id === model)?.reasoning ?? false;
}

export const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: "claude-opus-5",
  openai: "gpt-5",
};

export function defaultProvider(): Provider {
  const configured = process.env.DEFAULT_LLM_PROVIDER;
  return configured === "openai" ? "openai" : "anthropic";
}

export function resolveModel(provider: Provider, model?: string) {
  if (model && MODELS[provider].some((m) => m.id === model)) return model;
  return DEFAULT_MODEL[provider];
}
