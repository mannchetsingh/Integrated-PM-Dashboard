"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Eye,
  ListChecks,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/client";
import { useHubConfig } from "@/lib/hooks";
import { cx, parseList, toDateInput } from "@/lib/format";
import type { GeneratedMinutes, Meeting, Project } from "@/lib/types";
import { Markdown } from "./Markdown";
import { ModelPicker, type ModelChoice } from "./ModelPicker";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  ErrorBanner,
  Field,
  Input,
  Select,
  Textarea,
} from "./ui";

interface Draft {
  title: string;
  date: string;
  projectId: string;
  attendees: string;
  rawNotes: string;
  summary: string;
  minutes: string;
  decisions: string[];
  actionItems: { text: string; owner: string; due: string; taskId: string | null }[];
  tags: string;
}

const blankDraft = (projectId: string): Draft => ({
  title: "",
  date: toDateInput(new Date()),
  projectId,
  attendees: "",
  rawNotes: "",
  summary: "",
  minutes: "",
  decisions: [],
  actionItems: [],
  tags: "",
});

const fromMeeting = (meeting: Meeting): Draft => ({
  title: meeting.title,
  date: toDateInput(meeting.date),
  projectId: meeting.projectId ?? "",
  attendees: meeting.attendees.join(", "),
  rawNotes: meeting.rawNotes,
  summary: meeting.summary,
  minutes: meeting.minutes,
  decisions: meeting.decisions,
  actionItems: meeting.actionItems.map((item) => ({ ...item })),
  tags: meeting.tags.join(", "),
});

export function MeetingEditor({
  meeting,
  projects,
  defaultProjectId = "",
}: {
  /** null = a new, unsaved meeting. */
  meeting: Meeting | null;
  projects: Project[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const config = useHubConfig();

  const [choice, setChoice] = useState<ModelChoice>({ provider: undefined, model: undefined });
  const [draft, setDraft] = useState<Draft>(() =>
    meeting ? fromMeeting(meeting) : blankDraft(defaultProjectId),
  );
  const [meetingId, setMeetingId] = useState<string | null>(meeting?._id ?? null);

  const [instructions, setInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
  };

  // Clear the transient "pushed N tasks" style notice after a moment.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const pendingActions = useMemo(
    () => draft.actionItems.filter((item) => !item.taskId && item.text.trim()).length,
    [draft.actionItems],
  );

  const payload = () => ({
    title: draft.title.trim() || "Untitled meeting",
    date: draft.date || new Date().toISOString(),
    projectId: draft.projectId || null,
    attendees: parseList(draft.attendees),
    rawNotes: draft.rawNotes,
    summary: draft.summary,
    minutes: draft.minutes,
    decisions: draft.decisions.filter((entry) => entry.trim()),
    actionItems: draft.actionItems.filter((item) => item.text.trim()),
    tags: parseList(draft.tags),
  });

  /* ----- the main event: pointers in, minutes out ----- */
  async function generate() {
    if (!draft.rawNotes.trim()) {
      return setError("Add your rough notes or pointers first — that's what it works from.");
    }

    setGenerating(true);
    setError(null);
    try {
      const result = await api.post<GeneratedMinutes>("/api/meetings/generate", {
        notes: draft.rawNotes,
        title: draft.title,
        date: draft.date,
        attendees: parseList(draft.attendees),
        projectId: draft.projectId || null,
        instructions: instructions.trim() || undefined,
        provider: choice.provider,
        model: choice.model,
      });

      setDraft((previous) => ({
        ...previous,
        summary: result.summary || previous.summary,
        minutes: result.minutes || previous.minutes,
        decisions: result.decisions.length ? result.decisions : previous.decisions,
        // Keep anything already pushed to the board; add what's new.
        actionItems: [
          ...previous.actionItems.filter((item) => item.taskId),
          ...result.actionItems.map((item) => ({ ...item, taskId: null })),
        ],
      }));
      setDirty(true);
      setPreview(true);
      setNotice("Minutes drafted. Edit anything that isn't right, then save.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  async function save(options: { silent?: boolean } = {}) {
    setSaving(true);
    setError(null);
    try {
      const saved = meetingId
        ? await api.patch<Meeting>(`/api/meetings/${meetingId}`, payload())
        : await api.post<Meeting>("/api/meetings", payload());

      setDirty(false);

      if (!meetingId) {
        setMeetingId(saved._id);
        // Swap the URL from /meetings/new to the real record.
        router.replace(`/meetings/${saved._id}`);
      }
      if (!options.silent) setNotice("Saved.");
      return saved._id;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    } finally {
      setSaving(false);
    }
  }

  /** Action items become real tasks on the project's board. */
  async function pushToBoard() {
    if (!draft.projectId) {
      return setError("Assign this meeting to a project before pushing its action items.");
    }

    setPushing(true);
    setError(null);
    try {
      // Save first so the server pushes what's on screen, not a stale copy.
      const id = await save({ silent: true });
      if (!id) return;

      const result = await api.post<{ created: number; meeting: Meeting }>(
        `/api/meetings/${id}/push-tasks`,
      );
      setDraft(fromMeeting(result.meeting));
      setDirty(false);
      setNotice(
        result.created > 0
          ? `Added ${result.created} ${result.created === 1 ? "task" : "tasks"} to the board.`
          : "Every action item is already on the board.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPushing(false);
    }
  }

  async function handleDelete() {
    if (!meetingId) return;
    setDeleting(true);
    try {
      await api.del(`/api/meetings/${meetingId}`);
      router.push("/meetings");
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      {/* Header */}
      <div>
        <Link
          href="/meetings"
          className="inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeft size={13} />
          Meetings
        </Link>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
          <input
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Meeting title…"
            className="min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-tight text-ink placeholder:text-ink-faint focus:outline-none"
          />

          <div className="flex shrink-0 items-center gap-2">
            {dirty && <span className="text-xs text-amber-300/80">Unsaved changes</span>}
            <Button variant="primary" onClick={() => save()} loading={saving}>
              <Save size={14} />
              Save
            </Button>
            {meetingId && (
              <Button
                variant="danger"
                size="icon"
                onClick={() => setConfirmDelete(true)}
                title="Delete meeting"
                aria-label="Delete meeting"
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          <Check size={14} />
          {notice}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* ---------------- Left: the inputs ---------------- */}
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <Input
                  type="date"
                  value={draft.date}
                  onChange={(event) => update("date", event.target.value)}
                />
              </Field>
              <Field label="Project">
                <Select
                  value={draft.projectId}
                  onChange={(event) => update("projectId", event.target.value)}
                >
                  <option value="">None</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Attendees" hint="Comma separated.">
              <Input
                value={draft.attendees}
                onChange={(event) => update("attendees", event.target.value)}
                placeholder="Priya, Sam, Alex"
              />
            </Field>

            <Field label="Tags" hint="Comma separated.">
              <Input
                value={draft.tags}
                onChange={(event) => update("tags", event.target.value)}
                placeholder="weekly, client"
              />
            </Field>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-medium text-ink">Your pointers</h2>
            <p className="mt-0.5 text-xs text-ink-faint">
              Fragments are fine — half sentences, names, numbers, decisions. This is what the
              assistant writes from.
            </p>

            <Textarea
              rows={14}
              value={draft.rawNotes}
              onChange={(event) => update("rawNotes", event.target.value)}
              placeholder={
                "- budget approved, 40k\n" +
                "- priya to send revised scope by fri\n" +
                "- launch pushed to march, client ok\n" +
                "- open q: who owns the migration?"
              }
              className="mt-3 font-mono text-[13px] leading-relaxed"
            />

            <div className="mt-3 space-y-3 border-t border-line-soft pt-3">
              <Field label="Extra instructions" hint="Optional — tone, focus, what to emphasise.">
                <Input
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  placeholder="Keep it formal; call out risks."
                />
              </Field>

              <div className="flex items-center justify-between gap-2">
                <ModelPicker config={config} value={choice} onChange={setChoice} compact />
                <Button
                  variant="primary"
                  onClick={generate}
                  loading={generating}
                  disabled={!draft.rawNotes.trim()}
                >
                  <Wand2 size={14} />
                  {generating ? "Writing…" : draft.minutes ? "Rewrite minutes" : "Write minutes"}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* ---------------- Right: the minutes ---------------- */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
                <Sparkles size={14} className="text-accent-soft" />
                Summary
              </h2>
            </div>
            <Textarea
              rows={3}
              value={draft.summary}
              onChange={(event) => update("summary", event.target.value)}
              placeholder="A few lines on what happened and what it means."
              className="mt-2.5"
            />
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-ink">Minutes</h2>
              <Button size="sm" onClick={() => setPreview((value) => !value)}>
                {preview ? <Pencil size={13} /> : <Eye size={13} />}
                {preview ? "Edit" : "Preview"}
              </Button>
            </div>

            {preview ? (
              draft.minutes ? (
                <div className="mt-3 rounded-lg border border-line-soft bg-surface-2/40 px-4 py-3">
                  <Markdown>{draft.minutes}</Markdown>
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-ink-faint">
                  Nothing yet. Put your pointers on the left and press{" "}
                  <span className="text-ink">Write minutes</span>.
                </p>
              )
            ) : (
              <Textarea
                rows={18}
                value={draft.minutes}
                onChange={(event) => update("minutes", event.target.value)}
                placeholder="## Discussion&#10;…"
                className="mt-3 font-mono text-[13px] leading-relaxed"
              />
            )}
          </Card>

          {/* Decisions */}
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-ink">
                Decisions
                <span className="ml-1.5 text-xs text-ink-faint tabular-nums">
                  {draft.decisions.length}
                </span>
              </h2>
              <Button
                size="sm"
                onClick={() => update("decisions", [...draft.decisions, ""])}
              >
                <Plus size={13} />
                Add
              </Button>
            </div>

            {draft.decisions.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">None recorded.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {draft.decisions.map((decision, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-soft" />
                    <Textarea
                      rows={1}
                      value={decision}
                      onChange={(event) => {
                        const next = [...draft.decisions];
                        next[index] = event.target.value;
                        update("decisions", next);
                      }}
                      className="flex-1"
                      placeholder="What was decided"
                    />
                    <button
                      onClick={() =>
                        update(
                          "decisions",
                          draft.decisions.filter((_, i) => i !== index),
                        )
                      }
                      aria-label="Remove decision"
                      className="mt-1.5 rounded-md p-1 text-ink-faint transition-colors hover:bg-surface-2 hover:text-rose-300"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Action items */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
                <ListChecks size={14} className="text-ink-dim" />
                Action items
                <span className="text-xs text-ink-faint tabular-nums">
                  {draft.actionItems.length}
                </span>
              </h2>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    update("actionItems", [
                      ...draft.actionItems,
                      { text: "", owner: "", due: "", taskId: null },
                    ])
                  }
                >
                  <Plus size={13} />
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={pushToBoard}
                  loading={pushing}
                  disabled={pendingActions === 0}
                  title={
                    draft.projectId
                      ? undefined
                      : "Assign this meeting to a project first"
                  }
                >
                  <ListChecks size={13} />
                  Push {pendingActions > 0 ? pendingActions : ""} to board
                </Button>
              </div>
            </div>

            {draft.actionItems.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">
                None yet — the assistant pulls these out of your notes.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {draft.actionItems.map((item, index) => (
                  <li
                    key={index}
                    className={cx(
                      "rounded-lg border p-2.5",
                      item.taskId
                        ? "border-emerald-500/25 bg-emerald-500/5"
                        : "border-line bg-surface-2/40",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Textarea
                        rows={1}
                        value={item.text}
                        onChange={(event) => {
                          const next = [...draft.actionItems];
                          next[index] = { ...item, text: event.target.value };
                          update("actionItems", next);
                        }}
                        placeholder="What needs doing"
                        className="flex-1"
                      />
                      <button
                        onClick={() =>
                          update(
                            "actionItems",
                            draft.actionItems.filter((_, i) => i !== index),
                          )
                        }
                        aria-label="Remove action item"
                        className="mt-1.5 rounded-md p-1 text-ink-faint transition-colors hover:bg-surface-2 hover:text-rose-300"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input
                        value={item.owner}
                        onChange={(event) => {
                          const next = [...draft.actionItems];
                          next[index] = { ...item, owner: event.target.value };
                          update("actionItems", next);
                        }}
                        placeholder="Owner"
                        className="h-8 w-32 text-[13px]"
                      />
                      <Input
                        value={item.due}
                        onChange={(event) => {
                          const next = [...draft.actionItems];
                          next[index] = { ...item, due: event.target.value };
                          update("actionItems", next);
                        }}
                        placeholder="Due (as stated)"
                        className="h-8 w-40 text-[13px]"
                      />
                      {item.taskId && (
                        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                          <Check size={11} />
                          On the board
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {!draft.projectId && draft.actionItems.length > 0 && (
              <p className="mt-3 text-xs text-amber-300/80">
                Assign this meeting to a project to push these onto a task board.
              </p>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete this meeting?"
        message={`"${draft.title || "Untitled meeting"}" and its minutes will be permanently deleted. Tasks already pushed to the board stay.`}
      />
    </div>
  );
}
