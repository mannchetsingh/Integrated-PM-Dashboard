"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckSquare, Mic, Plus, Search, Users } from "lucide-react";
import { useResource } from "@/lib/hooks";
import { formatDate, truncate } from "@/lib/format";
import type { Meeting, Project } from "@/lib/types";
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

export default function MeetingsPage() {
  const { data: meetings, loading, error } = useResource<Meeting[]>("/api/meetings", []);
  const { data: projects } = useResource<Project[]>("/api/projects", []);

  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project._id, project])),
    [projects],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return meetings.filter((meeting) => {
      if (projectFilter && meeting.projectId !== projectFilter) return false;
      if (!needle) return true;
      return (
        meeting.title.toLowerCase().includes(needle) ||
        meeting.summary.toLowerCase().includes(needle) ||
        meeting.rawNotes.toLowerCase().includes(needle) ||
        meeting.attendees.some((attendee) => attendee.toLowerCase().includes(needle))
      );
    });
  }, [meetings, query, projectFilter]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <PageHeader
        title="Meetings"
        subtitle="Rough pointers in, finished minutes out."
        actions={
          <Link href="/meetings/new">
            <Button variant="primary">
              <Plus size={15} />
              New meeting
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
            placeholder="Search meetings, notes, attendees…"
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
      </div>

      {loading ? (
        <LoadingBlock />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Mic size={28} />}
          title={meetings.length === 0 ? "No meetings yet" : "Nothing matches"}
          description={
            meetings.length === 0
              ? "Paste in the half-sentences you scribbled during the call — the assistant turns them into minutes you can send."
              : "Try a different search or filter."
          }
          action={
            meetings.length === 0 && (
              <Link href="/meetings/new">
                <Button variant="primary">
                  <Plus size={15} />
                  Write up a meeting
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          {visible.map((meeting) => {
            const project = meeting.projectId ? projectsById.get(meeting.projectId) : null;
            const pending = meeting.actionItems.filter((item) => !item.taskId).length;

            return (
              <Link
                key={meeting._id}
                href={`/meetings/${meeting._id}`}
                className="block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="truncate font-medium text-ink">{meeting.title}</h2>
                  <time className="shrink-0 text-xs text-ink-faint">
                    {formatDate(meeting.date)}
                  </time>
                </div>

                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-faint">
                  {meeting.summary ||
                    truncate(meeting.rawNotes.replace(/\s+/g, " "), 180) ||
                    "No notes yet."}
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
                  {!meeting.minutes && meeting.rawNotes && (
                    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                      Notes only
                    </Badge>
                  )}
                  {meeting.actionItems.length > 0 && (
                    <Badge
                      className={
                        pending > 0
                          ? "border-accent/30 bg-accent/10 text-accent-soft"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      }
                    >
                      <CheckSquare size={11} />
                      {pending > 0
                        ? `${pending} to push`
                        : `${meeting.actionItems.length} on the board`}
                    </Badge>
                  )}
                  {meeting.attendees.length > 0 && (
                    <Badge>
                      <Users size={11} />
                      {meeting.attendees.length}
                    </Badge>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
