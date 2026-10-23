import { NextResponse } from "next/server";
import {
  LLMConfigError,
  streamLLM,
  toResponseStream,
  type LLMMessage,
  type Provider,
} from "@/lib/llm";
import { buildContext, systemPromptWithContext } from "@/lib/context";
import { badRequest, currentUserId, serverError, unauthorized } from "@/lib/api";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const body = await request.json();
    const messages: LLMMessage[] = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return badRequest("No messages to send.");

    // Keep the request bounded — the project snapshot already carries the
    // durable facts, so only recent turns need to come along.
    const recent = messages.slice(-20);

    const context = await buildContext(ownerId, body.projectId ?? null);

    const stream = toResponseStream(
      streamLLM({
        provider: body.provider as Provider | undefined,
        model: body.model,
        system: systemPromptWithContext(context),
        messages: recent,
        maxTokens: 16000,
        effort: "medium",
      }),
    );

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof LLMConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return serverError(error);
  }
}
