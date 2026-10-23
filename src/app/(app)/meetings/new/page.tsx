"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useResource } from "@/lib/hooks";
import type { Project } from "@/lib/types";
import { LoadingBlock } from "@/components/ui";
import { MeetingEditor } from "@/components/MeetingEditor";

function NewMeeting() {
  const searchParams = useSearchParams();
  const { data: projects, loading } = useResource<Project[]>("/api/projects", []);

  // Nothing is written until the user hits Save, so no empty records pile up.
  if (loading) return <LoadingBlock />;

  return (
    <MeetingEditor
      meeting={null}
      projects={projects}
      defaultProjectId={searchParams.get("projectId") ?? ""}
    />
  );
}

export default function NewMeetingPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <NewMeeting />
    </Suspense>
  );
}
