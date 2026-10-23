/**
 * The shapes the API actually returns — mongoose documents after
 * JSON.stringify, so _id and every Date have become strings.
 */

export const PROJECT_STATUSES = [
  "planning",
  "active",
  "on-hold",
  "completed",
  "archived",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ["todo", "in-progress", "blocked", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const DOC_KINDS = ["note", "spec", "draft", "report", "reference"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export interface Project {
  _id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  color: string;
  tags: string[];
  context: string;
  startDate: string | null;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  _id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  dueDate: string | null;
  order: number;
  sourceMeetingId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActionItem {
  text: string;
  owner: string;
  due: string;
  taskId: string | null;
}

export interface Meeting {
  _id: string;
  projectId: string | null;
  title: string;
  date: string;
  attendees: string[];
  rawNotes: string;
  minutes: string;
  summary: string;
  decisions: string[];
  actionItems: ActionItem[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Doc {
  _id: string;
  projectId: string | null;
  title: string;
  kind: DocKind;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

export interface Thread {
  _id: string;
  projectId: string | null;
  title: string;
  messages: ChatMessage[];
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

/** Thread list responses omit `messages` — the route projects them away. */
export type ThreadSummary = Omit<Thread, "messages" | "createdAt">;

export type Provider = "anthropic" | "openai" | "google";

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  google: "Gemini",
};

export interface ModelOption {
  id: string;
  label: string;
  hint: string;
  /** Takes adaptive thinking + effort. False for Haiku 4.5. */
  reasoning: boolean;
}

/** Served by /api/config so the picker only offers providers that have a key. */
export interface HubConfig {
  providers: Provider[];
  defaultProvider: Provider;
  models: Record<Provider, ModelOption[]>;
  defaultModel: Record<Provider, string>;
}

/** What the MOM generator returns before you save it onto the meeting. */
export interface GeneratedMinutes {
  summary: string;
  minutes: string;
  decisions: string[];
  actionItems: { text: string; owner: string; due: string }[];
}
