import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { badRequest, currentUserId, serverError, unauthorized } from "@/lib/api";

export async function GET() {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    await connectDB();
    const projects = await Project.find({ ownerId }).sort({ updatedAt: -1 }).lean();
    return NextResponse.json(projects);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await currentUserId();
    if (!ownerId) return unauthorized();

    const body = await request.json();
    if (!body.name?.trim()) return badRequest("A project name is required.");

    await connectDB();
    const project = await Project.create({
      ownerId,
      name: body.name.trim(),
      description: body.description ?? "",
      status: body.status ?? "active",
      color: body.color ?? "#6366f1",
      tags: body.tags ?? [],
      context: body.context ?? "",
      startDate: body.startDate || null,
      targetDate: body.targetDate || null,
    });

    return NextResponse.json(project.toObject(), { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
