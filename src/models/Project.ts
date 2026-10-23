import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const PROJECT_STATUSES = [
  "planning",
  "active",
  "on-hold",
  "completed",
  "archived",
] as const;

const ProjectSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: PROJECT_STATUSES, default: "active" },
    color: { type: String, default: "#6366f1" },
    tags: { type: [String], default: [] },
    /** Free-form background the AI should always know about this project. */
    context: { type: String, default: "" },
    startDate: { type: Date, default: null },
    targetDate: { type: Date, default: null },
  },
  { timestamps: true },
);

ProjectSchema.index({ ownerId: 1, updatedAt: -1 });

export type ProjectDoc = InferSchemaType<typeof ProjectSchema>;

export const Project: Model<ProjectDoc> =
  (mongoose.models.Project as Model<ProjectDoc>) ||
  mongoose.model<ProjectDoc>("Project", ProjectSchema);
