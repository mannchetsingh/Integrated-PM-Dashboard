import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ChatMessageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const ThreadSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    /** null = a hub-wide thread that can see every project. */
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    title: { type: String, default: "New chat" },
    messages: { type: [ChatMessageSchema], default: [] },
    provider: { type: String, default: "anthropic" },
    model: { type: String, default: "" },
  },
  { timestamps: true },
);

ThreadSchema.index({ ownerId: 1, updatedAt: -1 });

export type ThreadDoc = InferSchemaType<typeof ThreadSchema>;

export const Thread: Model<ThreadDoc> =
  (mongoose.models.Thread as Model<ThreadDoc>) ||
  mongoose.model<ThreadDoc>("Thread", ThreadSchema);
