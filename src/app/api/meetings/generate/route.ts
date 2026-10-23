import { NextResponse } from "next/server";
import { completeLLM, LLMConfigError, type Provider } from "@/lib/llm";
import { buildContext } from "@/lib/context";
import { badRequest, currentUserId, serverError, unauthorized } from "@/lib/api";

export const maxDuration = 60;

const MOM_SYSTEM = `You write minutes of meeting (MOM) from rough notes.

The user gives you fragments — half sentences, bullets, names, numbers. Turn them into minutes a colleague who missed the meeting could read and act on.

Rules:
- Only use what the notes and the project snapshot contain. Never invent a decision, a date, an owner or a number. If a point is ambiguous, write it as stated rather than resolving it.
- Where the notes imply an owner or deadline, attribute it; where they don't, leave the owner blank rather than guessing.
- Keep the user's domain terms and names exactly as written.
- Be concise and businesslike. No filler, no "the team discussed at length".

Respond with a single JSON object and nothing else — no prose before or after, no markdown fence:
{
  "summary": "2-4 sentence plain-language summary of what happened and what it means.",
  "minutes": "The full minutes as Markdown. Use ## headings such as Agenda / Discussion / Decisions / Next steps as the content warrants. Do not include a title heading — the meeting already has one.",
  "decisions": ["each decision as one self-contained sentence"],
  "actionItems": [{ "text": "what needs doing", "owner": "name or empty string", "due": "date/timeframe as stated, or empty string" }]
}`;

/** Models sometimes wrap JSON in a fence despite instructions. Dig it out. */
function parseJsonObject(raw: string) {
  let text = raw.trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) text = text.slice(start, end + 1);

  return JSON.parse(text);
}

export async function POST(request: Request) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const body = await request.json();
    const notes: string = (body.notes ?? "").trim();
    if (!notes) return badRequest("Add some notes or pointers first.");

    const context = body.projectId ? await buildContext(ownerId, body.projectId) : "";

    const parts = [
      body.title ? `Meeting title: ${body.title}` : "",
      body.date ? `Date: ${body.date}` : "",
      body.attendees?.length ? `Attendees: ${body.attendees.join(", ")}` : "",
      body.instructions ? `Extra instructions from the user: ${body.instructions}` : "",
      "",
      "Rough notes / pointers:",
      notes,
      context
        ? `\n\nFor background only — the project this meeting belongs to:\n<project_snapshot>\n${context}\n</project_snapshot>`
        : "",
    ].filter(Boolean);

    const raw = await completeLLM({
      provider: body.provider as Provider | undefined,
      model: body.model,
      system: MOM_SYSTEM,
      messages: [{ role: "user", content: parts.join("\n") }],
      maxTokens: 8000,
      effort: "high",
    });

    try {
      const parsed = parseJsonObject(raw);
      return NextResponse.json({
        summary: String(parsed.summary ?? ""),
        minutes: String(parsed.minutes ?? ""),
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map(String) : [],
        actionItems: Array.isArray(parsed.actionItems)
          ? parsed.actionItems.map((item: Record<string, unknown>) => ({
              text: String(item.text ?? ""),
              owner: String(item.owner ?? ""),
              due: String(item.due ?? ""),
            }))
          : [],
      });
    } catch {
      // Fall back to treating the whole response as the minutes body so the
      // user still gets their draft instead of an error.
      return NextResponse.json({
        summary: "",
        minutes: raw,
        decisions: [],
        actionItems: [],
      });
    }
  } catch (error) {
    if (error instanceof LLMConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return serverError(error);
  }
}
