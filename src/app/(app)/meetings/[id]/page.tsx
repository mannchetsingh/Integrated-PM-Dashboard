"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useResource } from "@/lib/hooks";
import type { Meeting, Project } from "@/lib/types";
import { Button, EmptyState, LoadingBlock } from "@/components/ui";
import { MeetingEditor } from "@/components/MeetingEditor";

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const { data: meeting, loading, error } = useResource<Meeting | null>(
    `/api/meetings/${id}`,
    null,
  );
  const { data: projects, loading: loadingProjects } = useResource<Project[]>(
    "/api/projects",
    [],
  );

  if (loading || loadingProjects) return <LoadingBlock label="Loading meeting…" />;

  if (error || !meeting) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <EmptyState
          title="Meeting not found"
          description={error ?? "It may have been deleted."}
          action={
            <Link href="/meetings">
              <Button>Back to meetings</Button>
            </Link>
          }
        />
      </div>
    );
  }

  // Remount the editor if the route changes to a different meeting.
  return <MeetingEditor key={meeting._id} meeting={meeting} projects={projects} />;
}
