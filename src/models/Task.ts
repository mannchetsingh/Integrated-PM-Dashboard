import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const TASK_STATUSES = ["todo", "in-progress", "blocked", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const TaskSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: TASK_STATUSES, default: "todo", index: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: "medium" },
    assignee: { type: String, default: "" },
    dueDate: { type: Date, default: null },
    /** Sort position within its status column. */
    order: { type: Number, default: 0 },
    /** Set when the task was created from a meeting's action items. */
    sourceMeetingId: { type: Schema.Types.ObjectId, ref: "Meeting", default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

TaskSchema.index({ ownerId: 1, status: 1, dueDate: 1 });

export type TaskDoc = InferSchemaType<typeof TaskSchema>;

export const Task: Model<TaskDoc> =
  (mongoose.models.Task as Model<TaskDoc>) ||
  mongoose.model<TaskDoc>("Task", TaskSchema);
