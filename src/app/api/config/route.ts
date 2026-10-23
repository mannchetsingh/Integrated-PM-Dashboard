import { NextResponse } from "next/server";
import { availableProviders, defaultProvider, DEFAULT_MODEL, MODELS } from "@/lib/llm";
import { currentUserId, serverError, unauthorized } from "@/lib/api";

/**
 * Tells the client which providers have a key configured, so the model picker
 * can hide the ones that would just fail. No secrets leave here — only names.
 */
export async function GET() {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const providers = availableProviders();

    return NextResponse.json({
      providers,
      // Fall back to a configured provider if the preferred one has no key.
      defaultProvider: providers.includes(defaultProvider())
        ? defaultProvider()
        : (providers[0] ?? defaultProvider()),
      models: MODELS,
      defaultModel: DEFAULT_MODEL,
    });
  } catch (error) {
    return serverError(error);
  }
}
