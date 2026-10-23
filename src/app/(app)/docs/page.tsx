"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileText, Pin, Plus, Search } from "lucide-react";
import { useResource } from "@/lib/hooks";
import { cx, DOC_KIND_LABEL, excerpt, relativeTime } from "@/lib/format";
import { DOC_KINDS, type Doc, type DocKind, type Project } from "@/lib/types";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  Input,
  LoadingBlock,
  PageHeader,
  Select,
} from "@/components/ui";

type KindFilter = DocKind | "all";

export default function DocsPage() {
  const { data: docs, loading, error } = useResource<Doc[]>("/api/docs", []);
  const { data: projects } = useResource<Project[]>("/api/projects", []);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [projectFilter, setProjectFilter] = useState("");

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project._id, project])),
    [projects],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return docs.filter((doc) => {
      if (kind !== "all" && doc.kind !== kind) return false;
      if (projectFilter && doc.projectId !== projectFilter) return false;
      if (!needle) return true;
      return (
        doc.title.toLowerCase().includes(needle) ||
        doc.content.toLowerCase().includes(needle) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(needle))
      );
    });
  }, [docs, kind, projectFilter, query]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <PageHeader
        title="Writing"
        subtitle="Specs, updates, reports — drafted with you or by the assistant."
        actions={
          <Link href="/docs/new">
            <Button variant="primary">
              <Plus size={15} />
              New document
            </Button>
          </Link>
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
            placeholder="Search documents…"
            className="pl-9"
          />
        </div>

        <Select
          value={projectFilter}
          onChange={(event) => setProjectFilter(event.target.value)}
          className="w-auto min-w-[10rem]"
          aria-label="Filter by project"
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project._id} value={project._id}>
              {project.name}
            </option>
          ))}
        </Select>

        <div className="flex flex-wrap gap-1">
          {(["all", ...DOC_KINDS] as KindFilter[]).map((entry) => (
            <button
              key={entry}
              onClick={() => setKind(entry)}
              className={cx(
                "rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                kind === entry
                  ? "border-accent/40 bg-accent/12 text-ink"
                  : "border-line bg-surface text-ink-dim hover:text-ink",
              )}
            >
              {entry === "all" ? "All" : DOC_KIND_LABEL[entry]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<FileText size={28} />}
          title={docs.length === 0 ? "Nothing written yet" : "Nothing matches"}
          description={
            docs.length === 0
              ? "Describe what you need and let the assistant draft it, then edit side by side with a live preview."
              : "Try a different search or filter."
          }
          action={
            docs.length === 0 && (
              <Link href="/docs/new">
                <Button variant="primary">
                  <Plus size={15} />
                  Start writing
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((doc) => {
            const project = doc.projectId ? projectsById.get(doc.projectId) : null;

            return (
              <Link
                key={doc._id}
                href={`/docs/${doc._id}`}
                className="flex flex-col rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="flex min-w-0 items-center gap-1.5 font-medium text-ink">
                    {doc.pinned && <Pin size={12} className="shrink-0 text-amber-300" />}
                    <span className="truncate">{doc.title}</span>
                  </h2>
                  <Badge>{DOC_KIND_LABEL[doc.kind]}</Badge>
                </div>

                <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-ink-faint">
                  {excerpt(doc.content, 200) || "Empty document."}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line-soft pt-3">
                  {project && (
                    <Badge>
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: project.color }}
                        aria-hidden
                      />
                      {project.name}
                    </Badge>
                  )}
                  {doc.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                  <span className="ml-auto text-[11px] text-ink-faint">
                    {relativeTime(doc.updatedAt)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
