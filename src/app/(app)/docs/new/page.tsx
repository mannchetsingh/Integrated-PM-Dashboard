"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useResource } from "@/lib/hooks";
import type { Project } from "@/lib/types";
import { LoadingBlock } from "@/components/ui";
import { DocEditor } from "@/components/DocEditor";

function NewDoc() {
  const searchParams = useSearchParams();
  const { data: projects, loading } = useResource<Project[]>("/api/projects", []);

  if (loading) return <LoadingBlock />;

  return (
    <DocEditor
      doc={null}
      projects={projects}
      defaultProjectId={searchParams.get("projectId") ?? ""}
    />
  );
}

export default function NewDocPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <NewDoc />
    </Suspense>
  );
}
