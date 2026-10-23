import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const DOC_KINDS = ["note", "spec", "draft", "report", "reference"] as const;

const DocSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    title: { type: String, required: true, trim: true },
    kind: { type: String, enum: DOC_KINDS, default: "note" },
    /** Markdown. */
    content: { type: String, default: "" },
    tags: { type: [String], default: [] },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);

DocSchema.index({ ownerId: 1, updatedAt: -1 });

export type DocDoc = InferSchemaType<typeof DocSchema>;

export const Doc: Model<DocDoc> =
  (mongoose.models.Doc as Model<DocDoc>) ||
  mongoose.model<DocDoc>("Doc", DocSchema);
