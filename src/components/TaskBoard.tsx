"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CheckSquare, Plus, User } from "lucide-react";
import { api, errorMessage } from "@/lib/client";
import {
  cx,
  dueLabel,
  isOverdue,
  PRIORITY_CLASS,
  TASK_STATUS_DOT,
  TASK_STATUS_LABEL,
} from "@/lib/format";
import { TASK_STATUSES, type Project, type Task, type TaskStatus } from "@/lib/types";
import { Badge, Button, EmptyState, ErrorBanner } from "./ui";
import { TaskModal } from "./TaskModal";

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

function TaskCard({
  task,
  project,
  showProject,
  onOpen,
  onDragStart,
  dragging,
}: {
  task: Task;
  project?: Project;
  showProject: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  dragging: boolean;
}) {
  const due = dueLabel(task.dueDate);
  const overdue = task.status !== "done" && isOverdue(task.dueDate);

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      tabIndex={0}
      role="button"
      className={cx(
        "group cursor-grab rounded-lg border border-line bg-surface-2 p-3 transition-colors",
        "hover:border-accent/40 hover:bg-surface-3 active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <p
        className={cx(
          "text-sm leading-snug font-medium",
          task.status === "done" ? "text-ink-faint line-through" : "text-ink",
        )}
      >
        {task.title}
      </p>

      {task.description && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-faint">
          {task.description}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {task.priority !== "medium" && (
          <Badge className={PRIORITY_CLASS[task.priority]}>{task.priority}</Badge>
        )}

        {due && (
          <Badge
            className={
              overdue
                ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                : "border-line bg-surface text-ink-dim"
            }
          >
            <CalendarDays size={11} />
            {due}
          </Badge>
        )}

        {task.assignee && (
          <Badge>
            <User size={11} />
            {task.assignee}
          </Badge>
        )}

        {showProject && project && (
          <Badge className="border-line bg-surface text-ink-dim">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: project.color }}
              aria-hidden
            />
            {project.name}
          </Badge>
        )}
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Board                                                                       */
/* -------------------------------------------------------------------------- */

export function TaskBoard({
  tasks,
  setTasks,
  projects,
  lockedProjectId,
  emptyHint,
}: {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  projects: Project[];
  /** Set on a project page — hides the project chip and the project picker. */
  lockedProjectId?: string;
  emptyHint?: string;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creatingIn, setCreatingIn] = useState<TaskStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project._id, project])),
    [projects],
  );

  const columns = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      todo: [],
      "in-progress": [],
      blocked: [],
      done: [],
    };
    for (const task of tasks) grouped[task.status]?.push(task);
    return grouped;
  }, [tasks]);

  /** Optimistic move — snap the card across, then persist. */
  async function moveTask(taskId: string, status: TaskStatus) {
    const task = tasks.find((entry) => entry._id === taskId);
    if (!task || task.status === status) return;

    const previous = tasks;
    setTasks((current) =>
      current.map((entry) => (entry._id === taskId ? { ...entry, status } : entry)),
    );

    try {
      const saved = await api.patch<Task>(`/api/tasks/${taskId}`, { status });
      setTasks((current) => current.map((entry) => (entry._id === taskId ? saved : entry)));
    } catch (err) {
      setTasks(previous);
      setError(errorMessage(err));
    }
  }

  const canCreate = !!lockedProjectId || projects.length > 0;

  if (!tasks.length && !creatingIn) {
    return (
      <div className="space-y-3">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <EmptyState
          icon={<CheckSquare size={28} />}
          title="No tasks yet"
          description={
            emptyHint ??
            (canCreate
              ? "Add the first task, or let the assistant pull action items out of a meeting."
              : "Create a project first — every task belongs to one.")
          }
          action={
            canCreate && (
              <Button variant="primary" onClick={() => setCreatingIn("todo")}>
                <Plus size={15} />
                New task
              </Button>
            )
          }
        />
        <TaskModal
          open={creatingIn !== null}
          onClose={() => setCreatingIn(null)}
          task={null}
          projects={projects}
          lockedProjectId={lockedProjectId}
          defaultStatus={creatingIn ?? "todo"}
          onSaved={(task) => setTasks((current) => [task, ...current])}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUSES.map((status) => {
          const items = columns[status];
          return (
            <section
              key={status}
              onDragOver={(event) => {
                event.preventDefault();
                setOverColumn(status);
              }}
              onDragLeave={() => setOverColumn((c) => (c === status ? null : c))}
              onDrop={(event) => {
                event.preventDefault();
                setOverColumn(null);
                if (draggingId) void moveTask(draggingId, status);
                setDraggingId(null);
              }}
              className={cx(
                "flex min-h-[8rem] flex-col rounded-xl border bg-surface/60 transition-colors",
                overColumn === status
                  ? "border-accent/50 bg-accent/5"
                  : "border-line",
              )}
            >
              <header className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cx("h-2 w-2 rounded-full", TASK_STATUS_DOT[status])}
                    aria-hidden
                  />
                  <h3 className="text-sm font-medium text-ink">{TASK_STATUS_LABEL[status]}</h3>
                  <span className="text-xs text-ink-faint">{items.length}</span>
                </div>
                {canCreate && (
                  <button
                    onClick={() => setCreatingIn(status)}
                    aria-label={`Add task to ${TASK_STATUS_LABEL[status]}`}
                    className="rounded-md p-1 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <Plus size={15} />
                  </button>
                )}
              </header>

              <div className="flex-1 space-y-2 px-2 pb-2">
                {items.map((task) => (
                  <TaskCard
                    key={task._id}
                    task={task}
                    project={projectsById.get(task.projectId)}
                    showProject={!lockedProjectId}
                    dragging={draggingId === task._id}
                    onDragStart={() => setDraggingId(task._id)}
                    onOpen={() => setEditing(task)}
                  />
                ))}

                {items.length === 0 && (
                  <p className="px-2 py-4 text-center text-xs text-ink-faint">
                    {overColumn === status ? "Drop here" : "Nothing here"}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <TaskModal
        open={editing !== null || creatingIn !== null}
        onClose={() => {
          setEditing(null);
          setCreatingIn(null);
        }}
        task={editing}
        projects={projects}
        lockedProjectId={lockedProjectId}
        defaultStatus={creatingIn ?? "todo"}
        onSaved={(task, isNew) =>
          setTasks((current) =>
            isNew
              ? [task, ...current]
              : current.map((entry) => (entry._id === task._id ? task : entry)),
          )
        }
        onDeleted={(taskId) =>
          setTasks((current) => current.filter((entry) => entry._id !== taskId))
        }
      />
    </div>
  );
}
