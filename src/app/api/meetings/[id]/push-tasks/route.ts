import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Meeting } from "@/models/Meeting";
import { Task } from "@/models/Task";
import { badRequest, currentUserId, notFound, serverError, unauthorized } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Turns a meeting's action items into real tasks on the board, once each. */
export async function POST(_request: Request, { params }: Ctx) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const { id } = await params;
    await connectDB();

    const meeting = await Meeting.findOne({ _id: id, ownerId });
    if (!meeting) return notFound("Meeting not found");
    if (!meeting.projectId) {
      return badRequest("Assign this meeting to a project before pushing its action items.");
    }

    let created = 0;

    for (const item of meeting.actionItems) {
      if (item.taskId || !item.text.trim()) continue;

      const task = await Task.create({
        ownerId,
        projectId: meeting.projectId,
        title: item.text.trim(),
        description: `From meeting: ${meeting.title}`,
        assignee: item.owner ?? "",
        status: "todo",
        order: Date.now() + created,
        sourceMeetingId: meeting._id,
      });

      item.taskId = task._id;
      created += 1;
    }

    if (created > 0) {
      meeting.markModified("actionItems");
      await meeting.save();
    }

    return NextResponse.json({ created, meeting: meeting.toObject() });
  } catch (error) {
    return serverError(error);
  }
}
