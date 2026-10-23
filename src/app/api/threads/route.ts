import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Thread } from "@/models/Thread";
import { currentUserId, serverError, unauthorized } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const query: Record<string, unknown> = { ownerId };

    const projectId = searchParams.get("projectId");
    if (projectId) query.projectId = projectId;
    else if (searchParams.get("scope") === "hub") query.projectId = null;

    await connectDB();
    const threads = await Thread.find(query)
      .sort({ updatedAt: -1 })
      .limit(50)
      .select("title projectId updatedAt provider model")
      .lean();

    return NextResponse.json(threads);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const body = await request.json().catch(() => ({}));

    await connectDB();
    const thread = await Thread.create({
      ownerId,
      projectId: body.projectId || null,
      title: body.title || "New chat",
      messages: body.messages ?? [],
      provider: body.provider ?? "anthropic",
      model: body.model ?? "",
    });

    return NextResponse.json(thread.toObject(), { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
