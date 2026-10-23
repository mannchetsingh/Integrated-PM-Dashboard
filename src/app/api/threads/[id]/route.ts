import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Thread } from "@/models/Thread";
import { currentUserId, notFound, serverError, unauthorized } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const { id } = await params;
    await connectDB();
    const thread = await Thread.findOne({ _id: id, ownerId }).lean();
    if (!thread) return notFound("Thread not found");

    return NextResponse.json(thread);
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
    if ("messages" in body) update.messages = body.messages;
    if ("title" in body) update.title = body.title;
    if ("provider" in body) update.provider = body.provider;
    if ("model" in body) update.model = body.model;

    await connectDB();
    const thread = await Thread.findOneAndUpdate({ _id: id, ownerId }, update, {
      new: true,
    }).lean();
    if (!thread) return notFound("Thread not found");

    return NextResponse.json(thread);
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

    const thread = await Thread.findOneAndDelete({ _id: id, ownerId });
    if (!thread) return notFound("Thread not found");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
