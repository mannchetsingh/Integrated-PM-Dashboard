"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  FileText,
  Info,
  Mic,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api, errorMessage } from "@/lib/client";
import { useResource } from "@/lib/hooks";
import {
  cx,
  DOC_KIND_LABEL,
  excerpt,
  formatDate,
  PROJECT_STATUS_CLASS,
  PROJECT_STATUS_LABEL,
  relativeTime,
} from "@/lib/format";
import type { Doc, Meeting, Project, Task } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
} from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { TaskBoard } from "@/components/TaskBoard";
import { ProjectModal } from "@/components/ProjectModal";
import { ChatPanel } from "@/components/ChatPanel";

const TABS = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "meetings", label: "Meetings", icon: Mic },
  { id: "docs", label: "Writing", icon: FileText },
  { id: "assistant", label: "Assistant", icon: Sparkles },
] as const;

type TabId = (typeof TABS)[number]["id"];

function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const requested = searchParams.get("tab") as TabId | null;
  const [tab, setTab] = useState<TabId>(
    requested && TABS.some((entry) => entry.id === requested) ? requested : "overview",
  );

  const { data: project, setData: setProject, loading, error } = useResource<Project | null>(
    `/api/projects/${id}`,
    null,
  );
  const { data: tasks, setData: setTasks } = useResource<Task[]>(
    `/api/tasks?projectId=${id}`,
    [],
  );
  const { data: meetings } = useResource<Meeting[]>(`/api/meetings?projectId=${id}`, []);
  const { data: docs } = useResource<Doc[]>(`/api/docs?projectId=${id}`, []);
  const { data: projects } = useResource<Project[]>("/api/projects", []);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const done = tasks.filter((task) => task.status === "done").length;
    return {
      done,
      total: tasks.length,
      open: tasks.length - done,
      blocked: tasks.filter((task) => task.status === "blocked").length,
      progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    };
  }, [tasks]);

  function selectTab(next: TabId) {
    setTab(next);
    // Keep the tab in the URL so the view survives a refresh or a shared link.
    router.replace(`/projects/${id}?tab=${next}`, { scroll: false });
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.del(`/api/projects/${id}`);
      router.push("/projects");
    } catch (err) {
      setDeleteError(errorMessage(err));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading project…" />;

  if (error || !project) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <EmptyState
          title="Project not found"
          description={error ?? "It may have been deleted."}
          action={
            <Link href="/projects">
              <Button>Back to projects</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="border-b border-line px-4 pt-4 md:px-6">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeft size={13} />
          Projects
        </Link>

        <div className="mt-2.5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
              aria-hidden
            />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">{project.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge className={PROJECT_STATUS_CLASS[project.status]}>
                  {PROJECT_STATUS_LABEL[project.status]}
                </Badge>
                {stats.total > 0 && (
                  <Badge>
                    <CheckSquare size={11} />
                    {stats.done}/{stats.total}
                  </Badge>
                )}
                {project.targetDate && (
                  <Badge>
                    <CalendarDays size={11} />
                    Target {formatDate(project.targetDate)}
                  </Badge>
                )}
                {project.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button onClick={() => setEditing(true)}>
              <Pencil size={14} />
              Edit
            </Button>
            <Button
              variant="danger"
              size="icon"
              onClick={() => setConfirmDelete(true)}
              title="Delete project"
              aria-label="Delete project"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        <nav className="-mb-px mt-4 flex gap-1 overflow-x-auto">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => selectTab(tabId)}
              className={cx(
                "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                tab === tabId
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-dim hover:text-ink",
              )}
            >
              <Icon size={15} />
              {label}
              {tabId === "tasks" && stats.open > 0 && (
                <span className="ml-0.5 rounded-full bg-surface-3 px-1.5 text-[11px] text-ink-dim tabular-nums">
                  {stats.open}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {deleteError && (
        <div className="px-4 pt-4 md:px-6">
          <ErrorBanner message={deleteError} onDismiss={() => setDeleteError(null)} />
        </div>
      )}

      {/* Body */}
      {tab === "assistant" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatPanel projectId={id} className="flex-1" heading={`Ask about ${project.name}`} />
        </div>
      ) : (
        <div className="flex-1 p-4 md:p-6">
          {tab === "overview" && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <Card className="p-5">
                  <h2 className="text-sm font-medium text-ink">About</h2>
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-ink-dim">
                    {project.description || "No description yet."}
                  </p>
                </Card>

                <Card className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
                        <Sparkles size={14} className="text-accent-soft" />
                        Background for the assistant
                      </h2>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        Injected into every question asked about this project.
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setEditing(true)}>
                      <Pencil size={13} />
                      Edit
                    </Button>
                  </div>

                  {project.context ? (
                    <div className="mt-3 border-t border-line-soft pt-3">
                      <Markdown compact>{project.context}</Markdown>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-ink-faint">
                      Nothing yet. Add goals, stakeholders, constraints and jargon — it&apos;s
                      what makes the assistant useful to someone new.
                    </p>
                  )}
                </Card>

                <Card className="p-5">
                  <h2 className="text-sm font-medium text-ink">Recent activity</h2>
                  {meetings.length === 0 && docs.length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink-faint">
                      No meetings or documents yet.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-1">
                      {[
                        ...meetings.slice(0, 3).map((meeting) => ({
                          key: `m-${meeting._id}`,
                          href: `/meetings/${meeting._id}`,
                          icon: Mic,
                          title: meeting.title,
                          when: meeting.date,
                        })),
                        ...docs.slice(0, 3).map((doc) => ({
                          key: `d-${doc._id}`,
                          href: `/docs/${doc._id}`,
                          icon: FileText,
                          title: doc.title,
                          when: doc.updatedAt,
                        })),
                      ]
                        .sort((a, b) => b.when.localeCompare(a.when))
                        .slice(0, 5)
                        .map(({ key, href, icon: Icon, title, when }) => (
                          <li key={key}>
                            <Link
                              href={href}
                              className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
                            >
                              <Icon size={14} className="shrink-0 text-ink-faint" />
                              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                                {title}
                              </span>
                              <span className="shrink-0 text-xs text-ink-faint">
                                {relativeTime(when)}
                              </span>
                            </Link>
                          </li>
                        ))}
                    </ul>
                  )}
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="p-5">
                  <h2 className="text-sm font-medium text-ink">Progress</h2>
                  <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                    {stats.progress}%
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${stats.progress}%` }}
                    />
                  </div>
                  <dl className="mt-4 space-y-2 border-t border-line-soft pt-4 text-sm">
                    {[
                      ["Open", stats.open],
                      ["Blocked", stats.blocked],
                      ["Done", stats.done],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <dt className="text-ink-faint">{label}</dt>
                        <dd className="tabular-nums text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>

                <Card className="p-5">
                  <h2 className="text-sm font-medium text-ink">Dates</h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-ink-faint">Started</dt>
                      <dd className="text-ink">{formatDate(project.startDate)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-faint">Target</dt>
                      <dd className="text-ink">{formatDate(project.targetDate)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-faint">Updated</dt>
                      <dd className="text-ink">{relativeTime(project.updatedAt)}</dd>
                    </div>
                  </dl>
                </Card>

                <Card className="space-y-2 p-5">
                  <h2 className="text-sm font-medium text-ink">Quick actions</h2>
                  <Link href={`/meetings/new?projectId=${id}`} className="block">
                    <Button className="w-full justify-start">
                      <Mic size={14} />
                      Write up a meeting
                    </Button>
                  </Link>
                  <Link href={`/docs/new?projectId=${id}`} className="block">
                    <Button className="w-full justify-start">
                      <FileText size={14} />
                      Start a document
                    </Button>
                  </Link>
                  <Button
                    className="w-full justify-start"
                    variant="primary"
                    onClick={() => selectTab("assistant")}
                  >
                    <Sparkles size={14} />
                    Ask the assistant
                  </Button>
                </Card>
              </div>
            </div>
          )}

          {tab === "tasks" && (
            <TaskBoard
              tasks={tasks}
              setTasks={setTasks}
              projects={projects}
              lockedProjectId={id}
            />
          )}

          {tab === "meetings" && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Link href={`/meetings/new?projectId=${id}`}>
                  <Button variant="primary">
                    <Plus size={15} />
                    New meeting
                  </Button>
                </Link>
              </div>

              {meetings.length === 0 ? (
                <EmptyState
                  icon={<Mic size={28} />}
                  title="No meetings yet"
                  description="Jot down rough pointers and let the assistant turn them into minutes."
                  action={
                    <Link href={`/meetings/new?projectId=${id}`}>
                      <Button variant="primary">
                        <Plus size={15} />
                        New meeting
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {meetings.map((meeting) => (
                    <Link
                      key={meeting._id}
                      href={`/meetings/${meeting._id}`}
                      className="block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="truncate font-medium text-ink">{meeting.title}</h3>
                        <span className="shrink-0 text-xs text-ink-faint">
                          {formatDate(meeting.date)}
                        </span>
                      </div>
                      {meeting.summary && (
                        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-faint">
                          {meeting.summary}
                        </p>
                      )}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {meeting.actionItems.length > 0 && (
                          <Badge>
                            <CheckSquare size={11} />
                            {meeting.actionItems.length} actions
                          </Badge>
                        )}
                        {meeting.decisions.length > 0 && (
                          <Badge>{meeting.decisions.length} decisions</Badge>
                        )}
                        {meeting.attendees.slice(0, 3).map((attendee) => (
                          <Badge key={attendee}>{attendee}</Badge>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "docs" && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Link href={`/docs/new?projectId=${id}`}>
                  <Button variant="primary">
                    <Plus size={15} />
                    New document
                  </Button>
                </Link>
              </div>

              {docs.length === 0 ? (
                <EmptyState
                  icon={<FileText size={28} />}
                  title="Nothing written yet"
                  description="Specs, updates, reports — drafted with you or by the assistant."
                  action={
                    <Link href={`/docs/new?projectId=${id}`}>
                      <Button variant="primary">
                        <Plus size={15} />
                        New document
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {docs.map((doc) => (
                    <Link
                      key={doc._id}
                      href={`/docs/${doc._id}`}
                      className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate font-medium text-ink">{doc.title}</h3>
                        <Badge>{DOC_KIND_LABEL[doc.kind]}</Badge>
                      </div>
                      <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-ink-faint">
                        {excerpt(doc.content) || "Empty document."}
                      </p>
                      <p className="mt-2.5 text-[11px] text-ink-faint">
                        {relativeTime(doc.updatedAt)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <ProjectModal
        open={editing}
        onClose={() => setEditing(false)}
        project={project}
        onSaved={(saved) => setProject(saved)}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete this project?"
        message={`"${project.name}" and all of its tasks, meetings and documents will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete everything"
      />
    </div>
  );
}

export default function ProjectPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={<LoadingBlock label="Loading project…" />}>
      <ProjectWorkspace />
    </Suspense>
  );
}
