import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Doc } from "@/models/Doc";
import { badRequest, currentUserId, serverError, unauthorized } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const query: Record<string, unknown> = { ownerId };

    const projectId = searchParams.get("projectId");
    if (projectId) query.projectId = projectId;

    const kind = searchParams.get("kind");
    if (kind) query.kind = kind;

    await connectDB();
    const docs = await Doc.find(query).sort({ pinned: -1, updatedAt: -1 }).lean();
    return NextResponse.json(docs);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const body = await request.json();
    if (!body.title?.trim()) return badRequest("A title is required.");

    await connectDB();
    const doc = await Doc.create({
      ownerId,
      projectId: body.projectId || null,
      title: body.title.trim(),
      kind: body.kind ?? "note",
      content: body.content ?? "",
      tags: body.tags ?? [],
      pinned: body.pinned ?? false,
    });

    return NextResponse.json(doc.toObject(), { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
