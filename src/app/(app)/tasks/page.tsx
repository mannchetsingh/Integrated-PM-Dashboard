"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useResource } from "@/lib/hooks";
import { cx, isOverdue } from "@/lib/format";
import type { Project, Task } from "@/lib/types";
import { Button, ErrorBanner, Input, LoadingBlock, PageHeader, Select } from "@/components/ui";
import { TaskBoard } from "@/components/TaskBoard";
import { TaskModal } from "@/components/TaskModal";

type Scope = "open" | "all" | "overdue";

export default function TasksPage() {
  const { data: tasks, setData: setTasks, loading, error } = useResource<Task[]>(
    "/api/tasks",
    [],
  );
  const { data: projects } = useResource<Project[]>("/api/projects", []);

  const [projectFilter, setProjectFilter] = useState("");
  const [scope, setScope] = useState<Scope>("open");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (projectFilter && task.projectId !== projectFilter) return false;
      if (scope === "open" && task.status === "done") return false;
      if (scope === "overdue" && !(task.status !== "done" && isOverdue(task.dueDate)))
        return false;
      if (!needle) return true;
      return (
        task.title.toLowerCase().includes(needle) ||
        task.description.toLowerCase().includes(needle) ||
        task.assignee.toLowerCase().includes(needle)
      );
    });
  }, [tasks, projectFilter, scope, query]);

  const counts = useMemo(
    () => ({
      open: tasks.filter((task) => task.status !== "done").length,
      all: tasks.length,
      overdue: tasks.filter((task) => task.status !== "done" && isOverdue(task.dueDate)).length,
    }),
    [tasks],
  );

  /**
   * The board writes back into the filtered slice, so map its updates onto the
   * full list rather than replacing it.
   */
  const setVisibleTasks: React.Dispatch<React.SetStateAction<Task[]>> = (update) => {
    setTasks((current) => {
      const filtered = typeof update === "function" ? update(visible) : update;
      const byId = new Map(filtered.map((task) => [task._id, task]));

      const merged = current
        // A task the board dropped was deleted — unless the filter hid it.
        .filter((task) => byId.has(task._id) || !visible.some((v) => v._id === task._id))
        .map((task) => byId.get(task._id) ?? task);

      // Anything the board created won't be in the full list yet.
      const known = new Set(merged.map((task) => task._id));
      return [...filtered.filter((task) => !known.has(task._id)), ...merged];
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <PageHeader
        title="Tasks"
        subtitle={`${counts.open} open · ${counts.all} total${
          counts.overdue ? ` · ${counts.overdue} overdue` : ""
        }`}
        actions={
          <Button
            variant="primary"
            onClick={() => setCreating(true)}
            disabled={projects.length === 0}
            title={projects.length === 0 ? "Create a project first" : undefined}
          >
            <Plus size={15} />
            New task
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[13rem] flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks…"
            className="pl-9"
          />
        </div>

        <Select
          value={projectFilter}
          onChange={(event) => setProjectFilter(event.target.value)}
          className="w-auto min-w-[11rem]"
          aria-label="Filter by project"
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project._id} value={project._id}>
              {project.name}
            </option>
          ))}
        </Select>

        <div className="flex gap-1">
          {(["open", "all", "overdue"] as Scope[]).map((entry) => (
            <button
              key={entry}
              onClick={() => setScope(entry)}
              className={cx(
                "rounded-lg border px-2.5 py-1.5 text-[13px] font-medium capitalize transition-colors",
                scope === entry
                  ? "border-accent/40 bg-accent/12 text-ink"
                  : "border-line bg-surface text-ink-dim hover:text-ink",
              )}
            >
              {entry}
              <span className="ml-1.5 text-ink-faint tabular-nums">{counts[entry]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <TaskBoard
          tasks={visible}
          setTasks={setVisibleTasks}
          projects={projects}
          lockedProjectId={projectFilter || undefined}
          emptyHint={
            tasks.length > 0
              ? "No tasks match these filters."
              : projects.length === 0
                ? "Create a project first — every task belongs to one."
                : undefined
          }
        />
      )}

      <TaskModal
        open={creating}
        onClose={() => setCreating(false)}
        task={null}
        projects={projects}
        lockedProjectId={projectFilter || undefined}
        onSaved={(task) => setTasks((current) => [task, ...current])}
      />
    </div>
  );
}
