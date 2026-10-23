import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { Meeting } from "@/models/Meeting";
import { Doc } from "@/models/Doc";
import { currentUserId, notFound, serverError, unauthorized } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE = [
  "name",
  "description",
  "status",
  "color",
  "tags",
  "context",
  "startDate",
  "targetDate",
] as const;

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const { id } = await params;
    await connectDB();
    const project = await Project.findOne({ _id: id, ownerId }).lean();
    if (!project) return notFound("Project not found");

    return NextResponse.json(project);
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
    const project = await Project.findOneAndUpdate({ _id: id, ownerId }, update, {
      new: true,
    }).lean();
    if (!project) return notFound("Project not found");

    return NextResponse.json(project);
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

    const project = await Project.findOneAndDelete({ _id: id, ownerId });
    if (!project) return notFound("Project not found");

    // Everything hanging off a project goes with it.
    await Promise.all([
      Task.deleteMany({ ownerId, projectId: id }),
      Meeting.deleteMany({ ownerId, projectId: id }),
      Doc.deleteMany({ ownerId, projectId: id }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
