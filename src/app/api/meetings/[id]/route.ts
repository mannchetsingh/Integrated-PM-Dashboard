import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Meeting } from "@/models/Meeting";
import { currentUserId, notFound, serverError, unauthorized } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE = [
  "title",
  "date",
  "attendees",
  "rawNotes",
  "minutes",
  "summary",
  "decisions",
  "actionItems",
  "tags",
  "projectId",
] as const;

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const { id } = await params;
    await connectDB();
    const meeting = await Meeting.findOne({ _id: id, ownerId }).lean();
    if (!meeting) return notFound("Meeting not found");

    return NextResponse.json(meeting);
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
    const meeting = await Meeting.findOneAndUpdate({ _id: id, ownerId }, update, {
      new: true,
    }).lean();
    if (!meeting) return notFound("Meeting not found");

    return NextResponse.json(meeting);
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

    const meeting = await Meeting.findOneAndDelete({ _id: id, ownerId });
    if (!meeting) return notFound("Meeting not found");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
