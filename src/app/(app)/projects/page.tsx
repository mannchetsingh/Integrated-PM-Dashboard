"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckSquare, FolderKanban, Plus, Search } from "lucide-react";
import { useResource } from "@/lib/hooks";
import {
  cx,
  formatDate,
  PROJECT_STATUS_CLASS,
  PROJECT_STATUS_LABEL,
  relativeTime,
  truncate,
} from "@/lib/format";
import { PROJECT_STATUSES, type Project, type ProjectStatus, type Task } from "@/lib/types";
import { Badge, Button, EmptyState, ErrorBanner, Input, LoadingBlock, PageHeader } from "@/components/ui";
import { ProjectModal } from "@/components/ProjectModal";

type Filter = ProjectStatus | "all";

export default function ProjectsPage() {
  const { data: projects, setData: setProjects, loading, error } = useResource<Project[]>(
    "/api/projects",
    [],
  );
  const { data: tasks } = useResource<Task[]>("/api/tasks", []);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);

  const taskCounts = useMemo(() => {
    const counts = new Map<string, { total: number; done: number }>();
    for (const task of tasks) {
      const entry = counts.get(task.projectId) ?? { total: 0, done: 0 };
      entry.total += 1;
      if (task.status === "done") entry.done += 1;
      counts.set(task.projectId, entry);
    }
    return counts;
  }, [tasks]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      if (filter !== "all" && project.status !== filter) return false;
      if (!needle) return true;
      return (
        project.name.toLowerCase().includes(needle) ||
        project.description.toLowerCase().includes(needle) ||
        project.tags.some((tag) => tag.toLowerCase().includes(needle))
      );
    });
  }, [projects, filter, query]);

  const counts = useMemo(() => {
    const result = new Map<Filter, number>([["all", projects.length]]);
    for (const status of PROJECT_STATUSES) {
      result.set(
        status,
        projects.filter((project) => project.status === status).length,
      );
    }
    return result;
  }, [projects]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} ${projects.length === 1 ? "project" : "projects"}`}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={15} />
            New project
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {(["all", ...PROJECT_STATUSES] as Filter[]).map((status) => {
            const count = counts.get(status) ?? 0;
            if (status !== "all" && count === 0) return null;

            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={cx(
                  "rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  filter === status
                    ? "border-accent/40 bg-accent/12 text-ink"
                    : "border-line bg-surface text-ink-dim hover:text-ink",
                )}
              >
                {status === "all" ? "All" : PROJECT_STATUS_LABEL[status]}
                <span className="ml-1.5 text-ink-faint tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={28} />}
          title={projects.length === 0 ? "No projects yet" : "Nothing matches"}
          description={
            projects.length === 0
              ? "A project is the container for its tasks, meetings, documents and everything the assistant knows."
              : "Try a different search or filter."
          }
          action={
            projects.length === 0 && (
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus size={15} />
                New project
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((project) => {
            const count = taskCounts.get(project._id);
            const progress = count?.total ? Math.round((count.done / count.total) * 100) : 0;

            return (
              <Link
                key={project._id}
                href={`/projects/${project._id}`}
                className="flex flex-col rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent/40"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-medium text-ink">{project.name}</h2>
                    <p className="mt-1 line-clamp-2 min-h-[2.4em] text-xs leading-relaxed text-ink-faint">
                      {truncate(project.description, 120) || "No description yet."}
                    </p>
                  </div>
                </div>

                {count?.total ? (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-ink-faint">
                      <span className="flex items-center gap-1">
                        <CheckSquare size={11} />
                        {count.done}/{count.total} done
                      </span>
                      <span className="tabular-nums">{progress}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line-soft pt-3">
                  <Badge className={PROJECT_STATUS_CLASS[project.status]}>
                    {PROJECT_STATUS_LABEL[project.status]}
                  </Badge>
                  {project.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                  <span
                    className="ml-auto text-[11px] text-ink-faint"
                    title={`Updated ${formatDate(project.updatedAt, "d MMM yyyy, HH:mm")}`}
                  >
                    {relativeTime(project.updatedAt)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <ProjectModal
        open={creating}
        onClose={() => setCreating(false)}
        project={null}
        onSaved={(project) => setProjects((current) => [project, ...current])}
      />
    </div>
  );
}
