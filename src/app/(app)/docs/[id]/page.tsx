"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useResource } from "@/lib/hooks";
import type { Doc, Project } from "@/lib/types";
import { Button, EmptyState, LoadingBlock } from "@/components/ui";
import { DocEditor } from "@/components/DocEditor";

export default function DocPage() {
  const { id } = useParams<{ id: string }>();
  const { data: doc, loading, error } = useResource<Doc | null>(`/api/docs/${id}`, null);
  const { data: projects, loading: loadingProjects } = useResource<Project[]>(
    "/api/projects",
    [],
  );

  if (loading || loadingProjects) return <LoadingBlock label="Loading document…" />;

  if (error || !doc) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <EmptyState
          title="Document not found"
          description={error ?? "It may have been deleted."}
          action={
            <Link href="/docs">
              <Button>Back to writing</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return <DocEditor key={doc._id} doc={doc} projects={projects} />;
}
