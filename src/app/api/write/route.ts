import { NextResponse } from "next/server";
import { LLMConfigError, streamLLM, toResponseStream, type Provider } from "@/lib/llm";
import { buildContext } from "@/lib/context";
import { badRequest, currentUserId, serverError, unauthorized } from "@/lib/api";

export const maxDuration = 60;

type Mode = "draft" | "continue" | "improve" | "shorten" | "expand" | "summarize";

const MODE_INSTRUCTIONS: Record<Mode, string> = {
  draft: "Write the document the user asked for, from scratch.",
  continue: "Continue the document from where it stops. Match its voice and formatting. Output only the new text — do not repeat what is already written.",
  improve: "Rewrite the document to be clearer and better organised. Keep every fact, name and number exactly as written. Output the full rewritten document.",
  shorten: "Tighten the document. Cut filler and repetition, keep all substance. Output the full shortened document.",
  expand: "Develop the document further — add the detail and structure it is missing, without inventing facts. Output the full expanded document.",
  summarize: "Write a short summary of the document.",
};

const WRITE_SYSTEM = `You are a writing assistant inside a project hub. You produce finished prose, not advice about writing.

Rules:
- Output only the document text. No preamble, no "Here's the draft", no closing commentary, no surrounding code fence.
- Write in Markdown.
- Never invent facts, names, dates or numbers. Use what the user gave you and what the project snapshot contains; where something is missing, write a clearly marked placeholder like **[owner TBD]** rather than guessing.
- Match the register the user asks for. Default to clear, direct business writing.`;

export async function POST(request: Request) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const body = await request.json();
    const mode: Mode = MODE_INSTRUCTIONS[body.mode as Mode] ? body.mode : "draft";
    const instruction: string = (body.instruction ?? "").trim();
    const current: string = body.content ?? "";

    if (mode === "draft" && !instruction) {
      return badRequest("Tell the assistant what to write.");
    }
    if (mode !== "draft" && !current.trim()) {
      return badRequest("There's nothing in the document yet.");
    }

    const context = body.projectId ? await buildContext(ownerId, body.projectId) : "";

    const parts = [
      MODE_INSTRUCTIONS[mode],
      instruction ? `\nWhat the user wants: ${instruction}` : "",
      current ? `\nThe current document:\n<document>\n${current}\n</document>` : "",
      context ? `\nProject background:\n<project_snapshot>\n${context}\n</project_snapshot>` : "",
    ].filter(Boolean);

    const stream = toResponseStream(
      streamLLM({
        provider: body.provider as Provider | undefined,
        model: body.model,
        system: WRITE_SYSTEM,
        messages: [{ role: "user", content: parts.join("\n") }],
        maxTokens: 16000,
        effort: "high",
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
