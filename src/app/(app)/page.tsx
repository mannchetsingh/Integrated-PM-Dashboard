"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckSquare,
  CircleDot,
  FileText,
  FolderKanban,
  Mic,
  Plus,
  Sparkles,
} from "lucide-react";
import { useResource } from "@/lib/hooks";
import {
  cx,
  dueLabel,
  isOverdue,
  PROJECT_STATUS_CLASS,
  PROJECT_STATUS_LABEL,
  relativeTime,
  TASK_STATUS_DOT,
  TASK_STATUS_LABEL,
  truncate,
} from "@/lib/format";
import { TASK_STATUSES, type Doc, type Meeting, type Project, type Task } from "@/lib/types";
import { Badge, Button, Card, LoadingBlock } from "@/components/ui";

/* -------------------------------------------------------------------------- */
/* Pieces                                                                      */
/* -------------------------------------------------------------------------- */

/** A hero number. Deliberately not a chart — one value needs no plot. */
function StatTile({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  hint?: string;
  href: string;
  tone?: "default" | "warn";
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent/40"
    >
      <p className="text-xs font-medium tracking-wide text-ink-dim uppercase">{label}</p>
      <p
        className={cx(
          "mt-2 text-3xl font-semibold tracking-tight tabular-nums",
          tone === "warn" && value > 0 ? "text-rose-300" : "text-ink",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </Link>
  );
}

/**
 * Task mix as isolated labelled rows rather than a stacked bar: each status is
 * named in text next to its own bar, so nothing depends on telling two colours
 * apart (emerald and rose are near-identical under deuteranopia).
 */
function StatusBreakdown({ tasks }: { tasks: Task[] }) {
  const counts = useMemo(() => {
    const result = { todo: 0, "in-progress": 0, blocked: 0, done: 0 } as Record<
      Task["status"],
      number
    >;
    for (const task of tasks) result[task.status] += 1;
    return result;
  }, [tasks]);

  const total = tasks.length;

  return (
    <Card className="p-4">
      <h2 className="text-sm font-medium text-ink">Task mix</h2>
      <p className="mt-0.5 text-xs text-ink-faint">
        {total} {total === 1 ? "task" : "tasks"} across every project
      </p>

      <ul className="mt-4 space-y-3">
        {TASK_STATUSES.map((status) => {
          const count = counts[status];
          const share = total ? Math.round((count / total) * 100) : 0;

          return (
            <li key={status}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-ink-dim">
                  <span
                    className={cx("h-2 w-2 rounded-full", TASK_STATUS_DOT[status])}
                    aria-hidden
                  />
                  {TASK_STATUS_LABEL[status]}
                </span>
                <span className="tabular-nums text-ink-faint">
                  {count} · {share}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className={cx("h-full rounded-full", TASK_STATUS_DOT[status])}
                  style={{ width: `${share}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function AttentionList({ tasks, projects }: { tasks: Task[]; projects: Project[] }) {
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project._id, project])),
    [projects],
  );

  const items = useMemo(
    () =>
      tasks
        .filter(
          (task) =>
            task.status !== "done" && (task.status === "blocked" || isOverdue(task.dueDate)),
        )
        .sort((a, b) => {
          // Blocked first, then soonest due date.
          if (a.status !== b.status) return a.status === "blocked" ? -1 : 1;
          return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
        })
        .slice(0, 6),
    [tasks],
  );

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={15} className="text-amber-300" />
        <h2 className="text-sm font-medium text-ink">Needs attention</h2>
      </div>

      {items.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-8 text-sm text-ink-faint">
          Nothing overdue or blocked. Good place to be.
        </p>
      ) : (
        <ul className="mt-3 flex-1 space-y-1.5">
          {items.map((task) => {
            const project = projectsById.get(task.projectId);
            const overdue = isOverdue(task.dueDate);

            return (
              <li key={task._id}>
                <Link
                  href={project ? `/projects/${project._id}?tab=tasks` : "/tasks"}
                  className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2"
                >
                  <span
                    className={cx(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      TASK_STATUS_DOT[task.status],
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{task.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                      {project && <span className="truncate">{project.name}</span>}
                      {task.status === "blocked" && (
                        <Badge className="border-rose-500/30 bg-rose-500/10 text-rose-300">
                          Blocked
                        </Badge>
                      )}
                      {overdue && (
                        <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                          Due {dueLabel(task.dueDate)}
                        </Badge>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function DashboardPage() {
  const { data: projects, loading: loadingProjects } = useResource<Project[]>(
    "/api/projects",
    [],
  );
  const { data: tasks, loading: loadingTasks } = useResource<Task[]>("/api/tasks", []);
  const { data: meetings } = useResource<Meeting[]>("/api/meetings", []);
  const { data: docs } = useResource<Doc[]>("/api/docs", []);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      activeProjects: projects.filter(
        (project) => project.status === "active" || project.status === "planning",
      ).length,
      openTasks: tasks.filter((task) => task.status !== "done").length,
      overdue: tasks.filter((task) => task.status !== "done" && isOverdue(task.dueDate)).length,
      doneThisWeek: tasks.filter(
        (task) => task.completedAt && new Date(task.completedAt).getTime() >= weekAgo,
      ).length,
    };
  }, [projects, tasks]);

  const recentProjects = projects.filter((project) => project.status !== "archived").slice(0, 6);
  const recentMeetings = meetings.slice(0, 4);

  if (loadingProjects && loadingTasks) {
    return (
      <div className="p-6">
        <LoadingBlock label="Loading your hub…" />
      </div>
    );
  }

  const isEmpty = projects.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-faint">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/meetings/new">
            <Button>
              <Mic size={15} />
              New meeting
            </Button>
          </Link>
          <Link href="/chat">
            <Button variant="primary">
              <Sparkles size={15} />
              Ask the assistant
            </Button>
          </Link>
        </div>
      </header>

      {isEmpty ? (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 ring-1 ring-accent/25">
            <FolderKanban size={22} className="text-accent-soft" />
          </div>
          <h2 className="text-lg font-medium">Start with a project</h2>
          <p className="mt-1.5 max-w-md text-sm text-ink-faint">
            Everything in the hub — tasks, meeting minutes, documents and what the assistant
            knows — hangs off a project.
          </p>
          <Link href="/projects" className="mt-5">
            <Button variant="primary" size="lg">
              <Plus size={16} />
              Create your first project
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Active projects"
              value={stats.activeProjects}
              hint={`${projects.length} total`}
              href="/projects"
            />
            <StatTile
              label="Open tasks"
              value={stats.openTasks}
              hint={`${tasks.length} total`}
              href="/tasks"
            />
            <StatTile
              label="Overdue"
              value={stats.overdue}
              hint="Past their due date"
              href="/tasks"
              tone="warn"
            />
            <StatTile
              label="Done this week"
              value={stats.doneThisWeek}
              hint="Last 7 days"
              href="/tasks"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <AttentionList tasks={tasks} projects={projects} />
            <StatusBreakdown tasks={tasks} />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-ink">Projects</h2>
              <Link
                href="/projects"
                className="flex items-center gap-1 text-xs text-ink-dim transition-colors hover:text-ink"
              >
                All projects <ArrowRight size={13} />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentProjects.map((project) => {
                const projectTasks = tasks.filter((task) => task.projectId === project._id);
                const done = projectTasks.filter((task) => task.status === "done").length;

                return (
                  <Link
                    key={project._id}
                    href={`/projects/${project._id}`}
                    className="group rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent/40"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: project.color }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-medium text-ink">{project.name}</h3>
                        <p className="mt-1 line-clamp-2 min-h-[2.4em] text-xs leading-relaxed text-ink-faint">
                          {truncate(project.description, 110) || "No description yet."}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Badge className={PROJECT_STATUS_CLASS[project.status]}>
                        {PROJECT_STATUS_LABEL[project.status]}
                      </Badge>
                      {projectTasks.length > 0 && (
                        <Badge>
                          <CheckSquare size={11} />
                          {done}/{projectTasks.length}
                        </Badge>
                      )}
                      <span className="ml-auto text-[11px] text-ink-faint">
                        {relativeTime(project.updatedAt)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Mic size={15} className="text-ink-dim" />
                  Recent meetings
                </h2>
                <Link
                  href="/meetings"
                  className="text-xs text-ink-dim transition-colors hover:text-ink"
                >
                  All
                </Link>
              </div>

              {recentMeetings.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-faint">
                  No meetings yet.{" "}
                  <Link href="/meetings/new" className="text-accent-soft hover:underline">
                    Write one up
                  </Link>
                  .
                </p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {recentMeetings.map((meeting) => (
                    <li key={meeting._id}>
                      <Link
                        href={`/meetings/${meeting._id}`}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
                      >
                        <CircleDot size={13} className="shrink-0 text-ink-faint" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">{meeting.title}</span>
                          <span className="text-xs text-ink-faint">
                            {relativeTime(meeting.date)}
                            {meeting.actionItems.length > 0 &&
                              ` · ${meeting.actionItems.length} action items`}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
                  <FileText size={15} className="text-ink-dim" />
                  Recent writing
                </h2>
                <Link
                  href="/docs"
                  className="text-xs text-ink-dim transition-colors hover:text-ink"
                >
                  All
                </Link>
              </div>

              {docs.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-faint">
                  Nothing written yet.{" "}
                  <Link href="/docs/new" className="text-accent-soft hover:underline">
                    Start a document
                  </Link>
                  .
                </p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {docs.slice(0, 4).map((doc) => (
                    <li key={doc._id}>
                      <Link
                        href={`/docs/${doc._id}`}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
                      >
                        <FileText size={13} className="shrink-0 text-ink-faint" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">{doc.title}</span>
                          <span className="text-xs text-ink-faint">
                            {relativeTime(doc.updatedAt)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
