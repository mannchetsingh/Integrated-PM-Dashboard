"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Columns2,
  Copy,
  Eye,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Save,
  Sparkles,
  Square,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { api, errorMessage, streamText } from "@/lib/client";
import { useAutosave, useHubConfig } from "@/lib/hooks";
import { cx, DOC_KIND_LABEL, parseList, relativeTime } from "@/lib/format";
import { DOC_KINDS, type Doc, type DocKind, type Project } from "@/lib/types";
import { Markdown } from "./Markdown";
import { ModelPicker, type ModelChoice } from "./ModelPicker";
import { Button, Card, ConfirmDialog, ErrorBanner, Field, Input, Select } from "./ui";

type Mode = "draft" | "continue" | "improve" | "shorten" | "expand" | "summarize";

/** How each mode's output lands: over the document, after it, or in a panel. */
const MODES: { id: Mode; label: string; hint: string; target: "replace" | "append" | "panel" }[] =
  [
    { id: "draft", label: "Draft", hint: "Write it from scratch", target: "replace" },
    { id: "continue", label: "Continue", hint: "Carry on from the end", target: "append" },
    { id: "improve", label: "Improve", hint: "Clearer, better organised", target: "replace" },
    { id: "shorten", label: "Shorten", hint: "Tighten without losing substance", target: "replace" },
    { id: "expand", label: "Expand", hint: "Add the missing detail", target: "replace" },
    { id: "summarize", label: "Summarise", hint: "A short summary, shown aside", target: "panel" },
  ];

type View = "write" | "preview" | "split";

export function DocEditor({
  doc,
  projects,
  defaultProjectId = "",
}: {
  /** null = a new, unsaved document. */
  doc: Doc | null;
  projects: Project[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const config = useHubConfig();

  const [docId, setDocId] = useState<string | null>(doc?._id ?? null);
  const [title, setTitle] = useState(doc?.title ?? "");
  const [kind, setKind] = useState<DocKind>(doc?.kind ?? "note");
  const [projectId, setProjectId] = useState(doc?.projectId ?? defaultProjectId);
  const [tags, setTags] = useState((doc?.tags ?? []).join(", "));
  const [pinned, setPinned] = useState(doc?.pinned ?? false);
  const [content, setContent] = useState(doc?.content ?? "");
  const [updatedAt, setUpdatedAt] = useState(doc?.updatedAt ?? "");

  const [view, setView] = useState<View>(doc?.content ? "split" : "write");
  const [choice, setChoice] = useState<ModelChoice>({ provider: undefined, model: undefined });
  const [mode, setMode] = useState<Mode>("draft");
  const [instruction, setInstruction] = useState("");
  const [running, setRunning] = useState(false);
  const [panel, setPanel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const payload = () => ({
    title: title.trim() || "Untitled",
    kind,
    projectId: projectId || null,
    tags: parseList(tags),
    pinned,
    content,
  });

  /* ----- saving ----- */

  // The id lives in a ref as well as state: an autosave firing moments after a
  // manual save must see the id the first write created, or it POSTs a second
  // copy instead of patching the first.
  const docIdRef = useRef<string | null>(doc?._id ?? null);
  const inFlightRef = useRef<Promise<Doc> | null>(null);

  const persist = async (): Promise<Doc> => {
    // Serialise writes so a create can never race another create.
    if (inFlightRef.current) await inFlightRef.current.catch(() => undefined);

    const request = (async () => {
      const body = payload();
      const saved = docIdRef.current
        ? await api.patch<Doc>(`/api/docs/${docIdRef.current}`, body)
        : await api.post<Doc>("/api/docs", body);

      if (!docIdRef.current) {
        docIdRef.current = saved._id;
        setDocId(saved._id);
        // Swap /docs/new for the real record without a navigation.
        router.replace(`/docs/${saved._id}`);
      }
      setUpdatedAt(saved.updatedAt);
      return saved;
    })();

    inFlightRef.current = request;
    try {
      return await request;
    } finally {
      if (inFlightRef.current === request) inFlightRef.current = null;
    }
  };

  const autosave = useAutosave(persist);

  /** Mark dirty and queue a save; every edit funnels through here. */
  const touch = () => autosave.schedule();

  async function saveNow() {
    setError(null);
    autosave.cancel();
    autosave.setStatus("saving");
    try {
      await persist();
      autosave.setStatus("saved");
    } catch (err) {
      autosave.setStatus("error");
      setError(errorMessage(err));
    }
  }

  /* ----- the assistant ----- */
  async function run(selected: Mode) {
    const spec = MODES.find((entry) => entry.id === selected)!;

    if (selected === "draft" && !instruction.trim()) {
      return setError("Tell it what to write — a line about the document you want.");
    }
    if (selected !== "draft" && !content.trim()) {
      return setError("There's nothing in the document yet. Use Draft first.");
    }

    setRunning(true);
    setError(null);
    setPanel(spec.target === "panel" ? "" : null);

    const controller = new AbortController();
    abortRef.current = controller;

    const before = content;
    const base = spec.target === "append" ? `${before}${before.endsWith("\n") ? "" : "\n\n"}` : "";

    try {
      await streamText(
        "/api/write",
        {
          mode: selected,
          instruction: instruction.trim(),
          content: before,
          projectId: projectId || null,
          provider: choice.provider,
          model: choice.model,
        },
        (_delta, soFar) => {
          if (spec.target === "panel") setPanel(soFar);
          else setContent(spec.target === "append" ? base + soFar : soFar);
        },
        controller.signal,
      );

      if (spec.target !== "panel") {
        if (view === "write") setView("split");
        touch();
      }
    } catch (err) {
      setError(errorMessage(err));
      if (spec.target !== "panel") setContent(before);
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  // Don't leave a generation running after the editor closes.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleDelete() {
    if (!docId) return;
    setDeleting(true);
    try {
      await api.del(`/api/docs/${docId}`);
      router.push("/docs");
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const status = autosave.status;
  const statusLabel =
    status === "saving"
      ? "Saving…"
      : status === "dirty"
        ? "Unsaved changes"
        : status === "error"
          ? "Couldn't save"
          : updatedAt
            ? `Saved ${relativeTime(updatedAt)}`
            : "Not saved yet";

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      {/* Header */}
      <div>
        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeft size={13} />
          Writing
        </Link>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              touch();
            }}
            placeholder="Untitled document"
            className="min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-tight text-ink placeholder:text-ink-faint focus:outline-none"
          />

          <div className="flex shrink-0 items-center gap-2">
            <span
              className={cx(
                "text-xs",
                status === "error" ? "text-rose-300" : "text-ink-faint",
              )}
            >
              {status === "saving" && <Loader2 size={11} className="mr-1 inline animate-spin" />}
              {statusLabel}
            </span>

            <Button
              size="icon"
              onClick={() => {
                setPinned((value) => !value);
                touch();
              }}
              title={pinned ? "Unpin" : "Pin to the top of the list"}
              aria-label={pinned ? "Unpin document" : "Pin document"}
            >
              {pinned ? <Pin size={14} className="text-amber-300" /> : <PinOff size={14} />}
            </Button>

            <Button variant="primary" onClick={saveNow} loading={status === "saving"}>
              <Save size={14} />
              Save
            </Button>

            {docId && (
              <Button
                variant="danger"
                size="icon"
                onClick={() => setConfirmDelete(true)}
                title="Delete document"
                aria-label="Delete document"
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Metadata */}
      <Card className="grid gap-3 p-3 sm:grid-cols-3">
        <Field label="Project">
          <Select
            value={projectId}
            onChange={(event) => {
              setProjectId(event.target.value);
              touch();
            }}
          >
            <option value="">None</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Kind">
          <Select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as DocKind);
              touch();
            }}
          >
            {DOC_KINDS.map((entry) => (
              <option key={entry} value={entry}>
                {DOC_KIND_LABEL[entry]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tags">
          <Input
            value={tags}
            onChange={(event) => {
              setTags(event.target.value);
              touch();
            }}
            placeholder="Comma separated"
          />
        </Field>
      </Card>

      {/* Assistant bar */}
      <Card className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <Sparkles size={14} className="text-accent-soft" />
            Assistant
          </span>

          <div className="flex flex-wrap gap-1">
            {MODES.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setMode(entry.id)}
                title={entry.hint}
                className={cx(
                  "rounded-lg border px-2.5 py-1 text-[13px] font-medium transition-colors",
                  mode === entry.id
                    ? "border-accent/40 bg-accent/12 text-ink"
                    : "border-line bg-surface-2 text-ink-dim hover:text-ink",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ModelPicker config={config} value={choice} onChange={setChoice} compact />
            {running ? (
              <Button onClick={() => abortRef.current?.abort()}>
                <Square size={12} className="fill-current" />
                Stop
              </Button>
            ) : (
              <Button variant="primary" onClick={() => run(mode)}>
                <Wand2 size={14} />
                Run
              </Button>
            )}
          </div>
        </div>

        <Input
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !running) run(mode);
          }}
          placeholder={
            mode === "draft"
              ? "What should it write? e.g. a one-page status update for the client, covering scope and the new launch date"
              : "Any steering for this pass (optional) — tone, audience, what to emphasise"
          }
        />

        <p className="text-xs text-ink-faint">
          {MODES.find((entry) => entry.id === mode)?.hint}
          {projectId
            ? " · it can see this project's tasks, meetings and documents"
            : " · pick a project above to give it your project context"}
        </p>
      </Card>

      {/* Summary panel */}
      {panel !== null && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-ink">Summary</h2>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(panel);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  } catch {
                    // Clipboard unavailable outside a secure context.
                  }
                }}
              >
                {copied ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setContent((current) => `${panel}\n\n---\n\n${current}`);
                  setPanel(null);
                  touch();
                }}
              >
                Insert at top
              </Button>
              <Button size="icon" onClick={() => setPanel(null)} aria-label="Dismiss summary">
                <X size={14} />
              </Button>
            </div>
          </div>
          <div className="mt-3 border-t border-line-soft pt-3">
            {panel ? (
              <Markdown compact>{panel}</Markdown>
            ) : (
              <p className="text-sm text-ink-faint">Writing…</p>
            )}
          </div>
        </Card>
      )}

      {/* Editor */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <span className="text-xs text-ink-faint tabular-nums">
            {content.length.toLocaleString()} characters ·{" "}
            {content.trim() ? content.trim().split(/\s+/).length.toLocaleString() : 0} words
          </span>

          <div className="flex gap-1">
            {(
              [
                ["write", "Write", Pencil],
                ["split", "Split", Columns2],
                ["preview", "Preview", Eye],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={cx(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  view === id
                    ? "bg-surface-3 text-ink"
                    : "text-ink-dim hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Icon size={12} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          className={cx(
            "min-h-[28rem]",
            view === "split" && "grid divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0",
          )}
        >
          {view !== "preview" && (
            // A plain textarea rather than the shared <Textarea>: this one needs
            // no border or background of its own, and overriding those with
            // conflicting utilities depends on stylesheet order, not class order.
            <textarea
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                touch();
              }}
              placeholder="Start writing in Markdown — or describe what you want above and press Run."
              className={cx(
                "min-h-[28rem] w-full resize-none px-4 py-4 font-mono text-[13px] leading-relaxed",
                "bg-transparent text-ink placeholder:text-ink-faint focus:outline-none",
                running && "opacity-80",
              )}
            />
          )}

          {view !== "write" && (
            <div className="min-h-[28rem] overflow-y-auto px-5 py-4">
              {content ? (
                <Markdown>{content}</Markdown>
              ) : (
                <p className="py-16 text-center text-sm text-ink-faint">
                  Nothing to preview yet.
                </p>
              )}
              {running && <span className="stream-caret" aria-label="Writing" />}
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete this document?"
        message={`"${title || "Untitled"}" will be permanently deleted. This can't be undone.`}
      />
    </div>
  );
}
