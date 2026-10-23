import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { currentUserId, notFound, serverError, unauthorized } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE = [
  "title",
  "description",
  "status",
  "priority",
  "assignee",
  "dueDate",
  "order",
  "projectId",
] as const;

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

    // Keep completedAt in sync so the dashboard can show recent throughput.
    if (body.status === "done") update.completedAt = new Date();
    else if ("status" in body) update.completedAt = null;

    await connectDB();
    const task = await Task.findOneAndUpdate({ _id: id, ownerId }, update, {
      new: true,
    }).lean();
    if (!task) return notFound("Task not found");

    return NextResponse.json(task);
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

    const task = await Task.findOneAndDelete({ _id: id, ownerId });
    if (!task) return notFound("Task not found");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
