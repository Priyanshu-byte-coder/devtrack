"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FolderKanban } from "lucide-react";
import KanbanBoard from "@/components/kanban/KanbanBoard";

interface ProjectPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default function KanbanProjectPage({ params }: ProjectPageProps) {
  const { projectId } = use(params);
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    fetch(`/api/kanban/${projectId}`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => {
        setProjectName(data.project?.name ?? "");
      })
      .catch(() => {});
  }, [projectId]);

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] transition-colors sm:px-6 lg:px-8 max-w-[1600px] mx-auto space-y-6">
      {/* Back button and title */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/kanban"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all shadow-sm"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-[var(--accent)]" />
            <h1 className="text-xl font-bold tracking-tight">
              {projectName || "Loading project..."}
            </h1>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            Kanban Workspace
          </p>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <KanbanBoard projectId={projectId} />
      </div>
    </main>
  );
}
