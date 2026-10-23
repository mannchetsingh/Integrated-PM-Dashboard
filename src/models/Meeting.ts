import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ActionItemSchema = new Schema(
  {
    text: { type: String, required: true },
    owner: { type: String, default: "" },
    due: { type: String, default: "" },
    /** Set once this item has been pushed into the task board. */
    taskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
  },
  { _id: false },
);

const MeetingSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    title: { type: String, required: true, trim: true },
    date: { type: Date, default: () => new Date() },
    attendees: { type: [String], default: [] },
    /** The rough pointers you type in during/after the meeting. */
    rawNotes: { type: String, default: "" },
    /** The polished minutes, usually written by the LLM from rawNotes. */
    minutes: { type: String, default: "" },
    summary: { type: String, default: "" },
    decisions: { type: [String], default: [] },
    actionItems: { type: [ActionItemSchema], default: [] },
    tags: { type: [String], default: [] },
  },
  { timestamps: true },
);

MeetingSchema.index({ ownerId: 1, date: -1 });

export type MeetingDoc = InferSchemaType<typeof MeetingSchema>;

export const Meeting: Model<MeetingDoc> =
  (mongoose.models.Meeting as Model<MeetingDoc>) ||
  mongoose.model<MeetingDoc>("Meeting", MeetingSchema);
