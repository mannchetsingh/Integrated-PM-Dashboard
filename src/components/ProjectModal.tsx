"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { cx, parseList, toDateInput, PROJECT_STATUS_LABEL } from "@/lib/format";
import { PROJECT_STATUSES, type Project, type ProjectStatus } from "@/lib/types";
import { Button, ErrorBanner, Field, Input, Modal, Select, Textarea } from "./ui";

/** Preset swatches — a free-form colour picker is more friction than it's worth. */
const SWATCHES = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#64748b",
];

interface Draft {
  name: string;
  description: string;
  status: ProjectStatus;
  color: string;
  tags: string;
  context: string;
  startDate: string;
  targetDate: string;
}

const EMPTY: Draft = {
  name: "",
  description: "",
  status: "active",
  color: SWATCHES[0],
  tags: "",
  context: "",
  startDate: "",
  targetDate: "",
};

const fromProject = (project: Project): Draft => ({
  name: project.name,
  description: project.description,
  status: project.status,
  color: project.color,
  tags: project.tags.join(", "),
  context: project.context,
  startDate: toDateInput(project.startDate),
  targetDate: toDateInput(project.targetDate),
});

export function ProjectModal({
  open,
  onClose,
  project,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** null = create. */
  project: Project | null;
  onSaved: (project: Project, isNew: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDraft(project ? fromProject(project) : EMPTY);
  }, [open, project]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));

  async function handleSave() {
    if (!draft.name.trim()) return setError("Give the project a name.");

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description,
        status: draft.status,
        color: draft.color,
        tags: parseList(draft.tags),
        context: draft.context,
        startDate: draft.startDate || null,
        targetDate: draft.targetDate || null,
      };
      const saved = project
        ? await api.patch<Project>(`/api/projects/${project._id}`, payload)
        : await api.post<Project>("/api/projects", payload);
      onSaved(saved, !project);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? "Edit project" : "New project"}
      description={
        project ? undefined : "Tasks, meetings and documents all hang off a project."
      }
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {project ? "Save changes" : "Create project"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <div className="flex gap-3">
          <Field label="Name" className="flex-1">
            <Input
              autoFocus
              value={draft.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="e.g. Website redesign"
            />
          </Field>

          <Field label="Status" className="w-44">
            <Select
              value={draft.status}
              onChange={(event) => update("status", event.target.value as ProjectStatus)}
            >
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PROJECT_STATUS_LABEL[status]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Description" hint="One or two lines — what this project is.">
          <Textarea
            rows={2}
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Rebuild the marketing site on the new design system."
          />
        </Field>

        <Field
          label="Background for the assistant"
          hint="Durable context the AI should always know: goals, stakeholders, constraints, jargon. This is injected into every question asked about this project."
        >
          <Textarea
            rows={5}
            value={draft.context}
            onChange={(event) => update("context", event.target.value)}
            placeholder={
              "Who the client is, what success looks like, key dates, the stack, who owns what, " +
              "any acronyms a newcomer wouldn't know…"
            }
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start date">
            <Input
              type="date"
              value={draft.startDate}
              onChange={(event) => update("startDate", event.target.value)}
            />
          </Field>
          <Field label="Target date">
            <Input
              type="date"
              value={draft.targetDate}
              onChange={(event) => update("targetDate", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Tags" hint="Comma separated.">
          <Input
            value={draft.tags}
            onChange={(event) => update("tags", event.target.value)}
            placeholder="client, q4, frontend"
          />
        </Field>

        <Field label="Colour">
          <div className="flex flex-wrap gap-2 pt-1">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => update("color", swatch)}
                aria-label={`Use colour ${swatch}`}
                aria-pressed={draft.color === swatch}
                className={cx(
                  "h-7 w-7 rounded-full transition-transform",
                  draft.color === swatch
                    ? "ring-2 ring-accent-soft ring-offset-2 ring-offset-surface"
                    : "hover:scale-110",
                )}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
