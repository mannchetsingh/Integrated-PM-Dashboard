import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { badRequest, currentUserId, serverError, unauthorized } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const query: Record<string, unknown> = { ownerId };

    const projectId = searchParams.get("projectId");
    if (projectId) query.projectId = projectId;

    const status = searchParams.get("status");
    if (status) query.status = status;

    await connectDB();
    const tasks = await Task.find(query).sort({ order: 1, createdAt: -1 }).lean();
    return NextResponse.json(tasks);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const body = await request.json();
    if (!body.title?.trim()) return badRequest("A task title is required.");
    if (!body.projectId) return badRequest("A task must belong to a project.");

    await connectDB();
    const task = await Task.create({
      ownerId,
      projectId: body.projectId,
      title: body.title.trim(),
      description: body.description ?? "",
      status: body.status ?? "todo",
      priority: body.priority ?? "medium",
      assignee: body.assignee ?? "",
      dueDate: body.dueDate || null,
      order: body.order ?? Date.now(),
      sourceMeetingId: body.sourceMeetingId || null,
    });

    return NextResponse.json(task.toObject(), { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
