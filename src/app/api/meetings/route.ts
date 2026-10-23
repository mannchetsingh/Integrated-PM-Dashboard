import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Meeting } from "@/models/Meeting";
import { badRequest, currentUserId, serverError, unauthorized } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const query: Record<string, unknown> = { ownerId };

    const projectId = searchParams.get("projectId");
    if (projectId) query.projectId = projectId;

    await connectDB();
    const meetings = await Meeting.find(query).sort({ date: -1 }).lean();
    return NextResponse.json(meetings);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const body = await request.json();
    if (!body.title?.trim()) return badRequest("A meeting title is required.");

    await connectDB();
    const meeting = await Meeting.create({
      ownerId,
      projectId: body.projectId || null,
      title: body.title.trim(),
      date: body.date || new Date(),
      attendees: body.attendees ?? [],
      rawNotes: body.rawNotes ?? "",
      minutes: body.minutes ?? "",
      summary: body.summary ?? "",
      decisions: body.decisions ?? [],
      actionItems: body.actionItems ?? [],
      tags: body.tags ?? [],
    });

    return NextResponse.json(meeting.toObject(), { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
