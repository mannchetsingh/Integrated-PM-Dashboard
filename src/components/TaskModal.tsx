"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/client";
import { toDateInput } from "@/lib/format";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Project,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/types";
import { TASK_STATUS_LABEL } from "@/lib/format";
import { Button, ConfirmDialog, ErrorBanner, Field, Input, Modal, Select, Textarea } from "./ui";

export interface TaskDraft {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  dueDate: string;
  projectId: string;
}

const emptyDraft = (projectId: string, status: TaskStatus): TaskDraft => ({
  title: "",
  description: "",
  status,
  priority: "medium",
  assignee: "",
  dueDate: "",
  projectId,
});

const fromTask = (task: Task): TaskDraft => ({
  title: task.title,
  description: task.description,
  status: task.status,
  priority: task.priority,
  assignee: task.assignee,
  dueDate: toDateInput(task.dueDate),
  projectId: task.projectId,
});

/**
 * Creates or edits one task. `task` null means create; `defaultStatus` seeds the
 * column the user clicked "+" in.
 */
export function TaskModal({
  open,
  onClose,
  task,
  projects,
  lockedProjectId,
  defaultStatus = "todo",
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  projects: Project[];
  /** When the board belongs to one project, don't make the user pick it. */
  lockedProjectId?: string;
  defaultStatus?: TaskStatus;
  onSaved: (task: Task, isNew: boolean) => void;
  onDeleted?: (taskId: string) => void;
}) {
  const [draft, setDraft] = useState<TaskDraft>(() =>
    emptyDraft(lockedProjectId ?? projects[0]?._id ?? "", defaultStatus),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset the form each time the dialog opens on a different task.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setDraft(
      task
        ? fromTask(task)
        : emptyDraft(lockedProjectId ?? projects[0]?._id ?? "", defaultStatus),
    );
  }, [open, task, lockedProjectId, defaultStatus, projects]);

  const update = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));

  async function handleSave() {
    if (!draft.title.trim()) return setError("Give the task a title.");
    if (!draft.projectId) return setError("Pick a project for this task.");

    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...draft,
        title: draft.title.trim(),
        dueDate: draft.dueDate || null,
      };
      const saved = task
        ? await api.patch<Task>(`/api/tasks/${task._id}`, payload)
        : await api.post<Task>("/api/tasks", payload);
      onSaved(saved, !task);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    setDeleting(true);
    try {
      await api.del(`/api/tasks/${task._id}`);
      onDeleted?.(task._id);
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={task ? "Edit task" : "New task"}
        footer={
          <>
            {task && onDeleted && (
              <Button
                variant="danger"
                size="md"
                className="mr-auto"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={14} />
                Delete
              </Button>
            )}
            <Button onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {task ? "Save changes" : "Create task"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          <Field label="Title">
            <Input
              autoFocus
              value={draft.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="What needs doing?"
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void handleSave();
              }}
            />
          </Field>

          <Field label="Details" hint="Optional — context, links, acceptance criteria.">
            <Textarea
              rows={4}
              value={draft.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Anything the assistant and your future self should know."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select
                value={draft.status}
                onChange={(event) => update("status", event.target.value as TaskStatus)}
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {TASK_STATUS_LABEL[status]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Priority">
              <Select
                value={draft.priority}
                onChange={(event) => update("priority", event.target.value as TaskPriority)}
              >
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority[0].toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Assignee">
              <Input
                value={draft.assignee}
                onChange={(event) => update("assignee", event.target.value)}
                placeholder="Name"
              />
            </Field>

            <Field label="Due date">
              <Input
                type="date"
                value={draft.dueDate}
                onChange={(event) => update("dueDate", event.target.value)}
              />
            </Field>
          </div>

          {!lockedProjectId && (
            <Field label="Project">
              <Select
                value={draft.projectId}
                onChange={(event) => update("projectId", event.target.value)}
              >
                <option value="">Select a project…</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete this task?"
        message={`"${task?.title}" will be removed permanently. This can't be undone.`}
      />
    </>
  );
}
