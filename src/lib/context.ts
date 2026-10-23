import { connectDB } from "./db";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { Meeting } from "@/models/Meeting";
import { Doc } from "@/models/Doc";

/** Rough character budget per section so a big project can't blow the context. */
const DOC_CHARS = 4000;
const MEETING_CHARS = 2500;

function clip(text: string, limit: number) {
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit)}\n…[truncated]` : text;
}

function fmtDate(value: Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * Builds the project knowledge that gets injected into the model's system
 * prompt. With a projectId it goes deep on one project; without one it gives a
 * cross-project overview so hub-wide questions still have something to chew on.
 */
export async function buildContext(ownerId: string, projectId?: string | null) {
  await connectDB();

  if (projectId) {
    return buildSingleProjectContext(ownerId, projectId);
  }
  return buildHubContext(ownerId);
}

async function buildSingleProjectContext(ownerId: string, projectId: string) {
  const project = await Project.findOne({ _id: projectId, ownerId }).lean();
  if (!project) return "No project found.";

  const [tasks, meetings, docs] = await Promise.all([
    Task.find({ ownerId, projectId }).sort({ status: 1, order: 1 }).lean(),
    Meeting.find({ ownerId, projectId }).sort({ date: -1 }).limit(10).lean(),
    Doc.find({ ownerId, projectId }).sort({ updatedAt: -1 }).limit(15).lean(),
  ]);

  const sections: string[] = [];

  sections.push(
    [
      `# Project: ${project.name}`,
      `Status: ${project.status}`,
      `Started: ${fmtDate(project.startDate)} · Target: ${fmtDate(project.targetDate)}`,
      project.tags.length ? `Tags: ${project.tags.join(", ")}` : "",
      "",
      project.description || "_No description._",
      project.context ? `\n## Background\n${project.context}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  if (tasks.length) {
    const byStatus = (status: string) =>
      tasks
        .filter((t) => t.status === status)
        .map(
          (t) =>
            `- ${t.title}${t.assignee ? ` (@${t.assignee})` : ""}` +
            `${t.dueDate ? ` — due ${fmtDate(t.dueDate)}` : ""}` +
            `${t.priority !== "medium" ? ` [${t.priority}]` : ""}` +
            `${t.description ? `\n    ${clip(t.description, 300)}` : ""}`,
        )
        .join("\n");

    sections.push(
      [
        "## Tasks",
        `In progress:\n${byStatus("in-progress") || "- none"}`,
        `Blocked:\n${byStatus("blocked") || "- none"}`,
        `To do:\n${byStatus("todo") || "- none"}`,
        `Done:\n${byStatus("done") || "- none"}`,
      ].join("\n\n"),
    );
  }

  if (meetings.length) {
    sections.push(
      "## Recent meetings\n\n" +
        meetings
          .map((m) => {
            const parts = [`### ${m.title} — ${fmtDate(m.date)}`];
            if (m.attendees.length) parts.push(`Attendees: ${m.attendees.join(", ")}`);
            if (m.summary) parts.push(m.summary);
            if (m.decisions.length)
              parts.push(`Decisions:\n${m.decisions.map((d) => `- ${d}`).join("\n")}`);
            if (m.actionItems.length)
              parts.push(
                `Action items:\n${m.actionItems
                  .map((a) => `- ${a.text}${a.owner ? ` (${a.owner})` : ""}${a.due ? ` — ${a.due}` : ""}`)
                  .join("\n")}`,
              );
            if (!m.summary && m.minutes) parts.push(clip(m.minutes, MEETING_CHARS));
            else if (!m.summary && !m.minutes && m.rawNotes)
              parts.push(`Raw notes: ${clip(m.rawNotes, MEETING_CHARS)}`);
            return parts.join("\n");
          })
          .join("\n\n"),
    );
  }

  if (docs.length) {
    sections.push(
      "## Documents\n\n" +
        docs
          .map((d) => `### ${d.title} (${d.kind})\n${clip(d.content, DOC_CHARS)}`)
          .join("\n\n"),
    );
  }

  return sections.join("\n\n---\n\n");
}

async function buildHubContext(ownerId: string) {
  const projects = await Project.find({ ownerId, status: { $ne: "archived" } })
    .sort({ updatedAt: -1 })
    .lean();

  if (!projects.length) return "The user has not created any projects yet.";

  const ids = projects.map((p) => p._id);

  const [tasks, meetings, docs] = await Promise.all([
    Task.find({ ownerId, projectId: { $in: ids } }).lean(),
    Meeting.find({ ownerId, projectId: { $in: ids } }).sort({ date: -1 }).limit(20).lean(),
    Doc.find({ ownerId, projectId: { $in: ids } }).sort({ updatedAt: -1 }).limit(20).lean(),
  ]);

  const blocks = projects.map((project) => {
    const pid = String(project._id);
    const ptasks = tasks.filter((t) => String(t.projectId) === pid);
    const open = ptasks.filter((t) => t.status !== "done");
    const pmeetings = meetings.filter((m) => String(m.projectId) === pid).slice(0, 3);
    const pdocs = docs.filter((d) => String(d.projectId) === pid).slice(0, 5);

    const lines = [
      `## ${project.name} (${project.status})`,
      project.description || "",
      project.context ? `Background: ${clip(project.context, 1200)}` : "",
      `Tasks: ${ptasks.length - open.length}/${ptasks.length} done.`,
    ];

    if (open.length) {
      lines.push(
        "Open work:\n" +
          open
            .slice(0, 15)
            .map((t) => `- [${t.status}] ${t.title}${t.dueDate ? ` (due ${fmtDate(t.dueDate)})` : ""}`)
            .join("\n"),
      );
    }

    if (pmeetings.length) {
      lines.push(
        "Latest meetings:\n" +
          pmeetings
            .map(
              (m) =>
                `- ${m.title} (${fmtDate(m.date)})${m.summary ? `: ${clip(m.summary, 600)}` : ""}`,
            )
            .join("\n"),
      );
    }

    if (pdocs.length) {
      lines.push(`Documents: ${pdocs.map((d) => d.title).join(", ")}`);
    }

    return lines.filter(Boolean).join("\n");
  });

  return `# All projects\n\n${blocks.join("\n\n---\n\n")}`;
}

export const ASSISTANT_SYSTEM = `You are the resident assistant for a personal project hub. You have been given a snapshot of the user's projects, tasks, meeting minutes and documents below.

How to answer:
- Ground every factual claim in the snapshot. If something isn't there, say so plainly instead of inventing it.
- Someone asking "what's the current status" is often new to the project — give them orientation, not just a list: what it is, where it stands, what's blocked, what's next.
- Prefer concrete detail (names, dates, task titles) over generalities.
- Use Markdown. Keep it tight; no preamble like "Great question".
- When the user asks you to draft something (minutes, an update, a summary), write the finished piece rather than describing what you would write.`;

export function systemPromptWithContext(context: string) {
  return `${ASSISTANT_SYSTEM}\n\n<project_snapshot>\n${context}\n</project_snapshot>`;
}
