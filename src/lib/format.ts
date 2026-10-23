import { format, formatDistanceToNowStrict, isPast, isToday, isTomorrow } from "date-fns";
import type { DocKind, ProjectStatus, TaskPriority, TaskStatus } from "./types";

type DateLike = string | number | Date | null | undefined;

const toDate = (value: DateLike) => (value ? new Date(value) : null);

export function formatDate(value: DateLike, pattern = "d MMM yyyy") {
  const date = toDate(value);
  return date && !Number.isNaN(date.getTime()) ? format(date, pattern) : "—";
}

/** "3 days ago" / "in 2 hours" — for updatedAt lines. */
export function relativeTime(value: DateLike) {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  const distance = formatDistanceToNowStrict(date);
  return date.getTime() > Date.now() ? `in ${distance}` : `${distance} ago`;
}

/** Friendlier wording for due dates, where today/tomorrow matter most. */
export function dueLabel(value: DateLike) {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return null;
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "d MMM");
}

export function isOverdue(value: DateLike) {
  const date = toDate(value);
  return !!date && !Number.isNaN(date.getTime()) && isPast(date) && !isToday(date);
}

/** <input type="date"> wants yyyy-MM-dd and nothing else. */
export function toDateInput(value: DateLike) {
  const date = toDate(value);
  return date && !Number.isNaN(date.getTime()) ? format(date, "yyyy-MM-dd") : "";
}

export function toDateTimeInput(value: DateLike) {
  const date = toDate(value);
  return date && !Number.isNaN(date.getTime()) ? format(date, "yyyy-MM-dd'T'HH:mm") : "";
}

/* -------------------------------------------------------------------------- */
/* Labels and colours                                                          */
/* -------------------------------------------------------------------------- */

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  "in-progress": "In progress",
  blocked: "Blocked",
  done: "Done",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  "on-hold": "On hold",
  completed: "Completed",
  archived: "Archived",
};

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  note: "Note",
  spec: "Spec",
  draft: "Draft",
  report: "Report",
  reference: "Reference",
};

/** Tailwind classes, kept as whole strings so the JIT can see them. */
export const TASK_STATUS_CLASS: Record<TaskStatus, string> = {
  todo: "bg-slate-500/15 text-slate-300 border-slate-500/25",
  "in-progress": "bg-sky-500/15 text-sky-300 border-sky-500/25",
  blocked: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
};

export const TASK_STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  "in-progress": "bg-sky-400",
  blocked: "bg-rose-400",
  done: "bg-emerald-400",
};

export const PROJECT_STATUS_CLASS: Record<ProjectStatus, string> = {
  planning: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  "on-hold": "bg-amber-500/15 text-amber-300 border-amber-500/25",
  completed: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  archived: "bg-slate-500/15 text-slate-400 border-slate-500/25",
};

export const PRIORITY_CLASS: Record<TaskPriority, string> = {
  low: "bg-slate-500/15 text-slate-400 border-slate-500/25",
  medium: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  high: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  urgent: "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

/* -------------------------------------------------------------------------- */
/* Misc                                                                        */
/* -------------------------------------------------------------------------- */

export function initials(name?: string | null) {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Splits "alice, bob" / "alice bob" style input into a clean list. */
export function parseList(value: string) {
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function truncate(text: string, limit: number) {
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}

/** First meaningful line of a Markdown blob, for list previews. */
export function excerpt(markdown: string, limit = 160) {
  const line = markdown
    .split("\n")
    .map((entry) => entry.replace(/^[#>\-*\s]+/, "").trim())
    .find(Boolean);
  return truncate(line ?? "", limit);
}

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");
