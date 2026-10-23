"use client";

import { useMemo, useState } from "react";
import { MessageSquare, Plus, Trash2, X } from "lucide-react";
import { api, errorMessage } from "@/lib/client";
import { useResource } from "@/lib/hooks";
import { cx, relativeTime, truncate } from "@/lib/format";
import type { Project, Thread, ThreadSummary } from "@/lib/types";
import { Button, ErrorBanner, Select, Spinner } from "@/components/ui";
import { ChatPanel } from "@/components/ChatPanel";

export default function ChatPage() {
  const {
    data: threads,
    setData: setThreads,
    loading,
    error,
  } = useResource<ThreadSummary[]>("/api/threads", []);
  const { data: projects } = useResource<Project[]>("/api/projects", []);

  // null threadId = a fresh chat that hasn't been saved yet.
  const [threadId, setThreadId] = useState<string | null>(null);
  const [scope, setScope] = useState<string>("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project._id, project])),
    [projects],
  );

  function startNew() {
    setThreadId(null);
    setShowList(false);
  }

  function openThread(thread: ThreadSummary) {
    setThreadId(thread._id);
    setScope(thread.projectId ?? "");
    setShowList(false);
  }

  async function removeThread(id: string) {
    const previous = threads;
    setThreads((current) => current.filter((thread) => thread._id !== id));
    if (threadId === id) setThreadId(null);

    try {
      await api.del(`/api/threads/${id}`);
    } catch (err) {
      setThreads(previous);
      setDeleteError(errorMessage(err));
    }
  }

  function upsertThread(thread: Thread) {
    const summary: ThreadSummary = {
      _id: thread._id,
      title: thread.title,
      projectId: thread.projectId,
      provider: thread.provider,
      model: thread.model,
      updatedAt: thread.updatedAt,
    };
    setThreads((current) => [summary, ...current.filter((entry) => entry._id !== thread._id)]);
  }

  const threadList = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-line p-3">
        <Button variant="primary" className="w-full" onClick={startNew}>
          <Plus size={15} />
          New chat
        </Button>

        <Select
          value={scope}
          onChange={(event) => {
            setScope(event.target.value);
            // Changing scope starts a fresh conversation — an existing thread
            // keeps the context it was created with.
            setThreadId(null);
          }}
          aria-label="What the assistant can see"
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project._id} value={project._id}>
              Only: {project.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : threads.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-ink-faint">
            No conversations yet.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {threads.map((thread) => {
              const project = thread.projectId ? projectsById.get(thread.projectId) : null;

              return (
                <li key={thread._id} className="group relative">
                  <button
                    onClick={() => openThread(thread)}
                    className={cx(
                      "w-full rounded-lg px-2.5 py-2 pr-8 text-left transition-colors",
                      threadId === thread._id
                        ? "bg-accent/12 ring-1 ring-accent/25"
                        : "hover:bg-surface-2",
                    )}
                  >
                    <span className="block truncate text-[13px] text-ink">
                      {truncate(thread.title, 48)}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
                      {project && (
                        <>
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: project.color }}
                            aria-hidden
                          />
                          <span className="truncate">{project.name}</span>
                          <span>·</span>
                        </>
                      )}
                      {relativeTime(thread.updatedAt)}
                    </span>
                  </button>

                  <button
                    onClick={() => removeThread(thread._id)}
                    title="Delete conversation"
                    aria-label={`Delete ${thread.title}`}
                    className="absolute top-2 right-1.5 rounded-md p-1 text-ink-faint opacity-0 transition-all group-hover:opacity-100 hover:bg-surface-3 hover:text-rose-300"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh min-h-0">
      {/* Desktop thread rail */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface/50 lg:block">
        {threadList}
      </aside>

      {/* Mobile drawer */}
      {showList && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowList(false)}
          />
          <aside className="animate-in absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="text-sm font-medium">Conversations</span>
              <button
                onClick={() => setShowList(false)}
                aria-label="Close"
                className="rounded-md p-1 text-ink-faint hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1">{threadList}</div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2 lg:hidden">
          <Button size="sm" onClick={() => setShowList(true)}>
            <MessageSquare size={14} />
            Conversations
          </Button>
          <Button size="sm" variant="primary" onClick={startNew} className="ml-auto">
            <Plus size={14} />
            New
          </Button>
        </div>

        {(error || deleteError) && (
          <div className="p-3">
            <ErrorBanner
              message={error ?? deleteError ?? ""}
              onDismiss={() => setDeleteError(null)}
            />
          </div>
        )}

        <ChatPanel
          // Remount on a scope change; thread switches are handled internally.
          key={scope}
          threadId={threadId}
          projectId={scope || null}
          className="min-h-0 flex-1"
          onThreadCreated={(thread) => {
            upsertThread(thread);
            setThreadId(thread._id);
          }}
          onThreadUpdated={upsertThread}
        />
      </div>
    </div>
  );
}
