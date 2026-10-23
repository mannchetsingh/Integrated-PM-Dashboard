"use client";

import { useEffect } from "react";
import { Cpu } from "lucide-react";
import { PROVIDER_LABEL, type HubConfig, type Provider } from "@/lib/types";
import { cx } from "@/lib/format";

export interface ModelChoice {
  provider: Provider | undefined;
  model: string | undefined;
}

/**
 * Provider + model selector. Only providers with a configured API key appear;
 * when just one is configured the provider dropdown collapses away.
 */
export function ModelPicker({
  config,
  value,
  onChange,
  className,
  compact = false,
}: {
  config: HubConfig | null;
  value: ModelChoice;
  onChange: (next: ModelChoice) => void;
  className?: string;
  compact?: boolean;
}) {
  const provider = value.provider ?? config?.defaultProvider;

  // Once config lands, settle on a real provider/model so requests carry one.
  useEffect(() => {
    if (!config || value.provider) return;
    const initial = config.defaultProvider;
    onChange({ provider: initial, model: config.defaultModel[initial] });
    // Running only when config first arrives is the point here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  if (!config) return null;

  if (config.providers.length === 0) {
    return (
      <span className="text-xs text-amber-300/80">
        No API key configured — add ANTHROPIC_API_KEY, OPENAI_API_KEY or GOOGLE_API_KEY.
      </span>
    );
  }

  const models = provider ? (config.models[provider] ?? []) : [];
  const selectClass = cx(
    "cursor-pointer rounded-md border border-line bg-surface-2 text-ink transition-colors",
    "hover:border-accent/40 focus:border-accent focus:outline-none",
    compact ? "h-7 px-1.5 text-xs" : "h-8 px-2 text-[13px]",
  );

  return (
    <div className={cx("flex items-center gap-1.5", className)}>
      {!compact && <Cpu size={14} className="text-ink-faint" />}

      {config.providers.length > 1 && (
        <select
          aria-label="Provider"
          value={provider}
          onChange={(event) => {
            const next = event.target.value as Provider;
            onChange({ provider: next, model: config.defaultModel[next] });
          }}
          className={selectClass}
        >
          {config.providers.map((entry) => (
            <option key={entry} value={entry}>
              {PROVIDER_LABEL[entry]}
            </option>
          ))}
        </select>
      )}

      <select
        aria-label="Model"
        value={value.model ?? (provider ? config.defaultModel[provider] : "")}
        onChange={(event) => onChange({ provider, model: event.target.value })}
        className={selectClass}
        title={models.find((entry) => entry.id === value.model)?.hint}
      >
        {models.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.label}
          </option>
        ))}
      </select>
    </div>
  );
}
