import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Doc } from "@/models/Doc";
import { currentUserId, notFound, serverError, unauthorized } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE = ["title", "kind", "content", "tags", "pinned", "projectId"] as const;

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const { id } = await params;
    await connectDB();
    const doc = await Doc.findOne({ _id: id, ownerId }).lean();
    if (!doc) return notFound("Document not found");

    return NextResponse.json(doc);
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const { id } = await params;
    const body = await request.json();

    const update: Record<string, unknown> = {};
    for (const key of EDITABLE) {
      if (key in body) update[key] = body[key];
    }

    await connectDB();
    const doc = await Doc.findOneAndUpdate({ _id: id, ownerId }, update, {
      new: true,
    }).lean();
    if (!doc) return notFound("Document not found");

    return NextResponse.json(doc);
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const { id } = await params;
    await connectDB();

    const doc = await Doc.findOneAndDelete({ _id: id, ownerId });
    if (!doc) return notFound("Document not found");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
