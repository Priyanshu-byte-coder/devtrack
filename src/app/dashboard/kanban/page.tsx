"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderKanban, Plus, Trash2, ArrowRight } from "lucide-react";

interface Project {
  id: string;
  name: string;
  created_at: string;
}

export default function KanbanLandingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/kanban");
      if (!res.ok) throw new Error("Failed to load projects");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProjectName.trim();
    if (!name) return;

    setCreating(true);
    try {
      const res = await fetch("/api/kanban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      setNewProjectName("");
      await fetchProjects();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this project? This will permanently delete all workflow columns and tasks inside it.")) return;

    try {
      const res = await fetch(`/api/kanban/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete project");
      await fetchProjects();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] transition-colors sm:px-6 lg:px-8 max-w-[1200px] mx-auto space-y-8">
      {/* Title */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <FolderKanban className="h-8 w-8 text-[var(--accent)]" />
          <h1 className="text-3xl font-extrabold tracking-tight">Kanban Boards</h1>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          Manage your developer tasks and project stages in custom workspaces.
        </p>
      </div>

      {/* Grid of Projects */}
      <div className="grid md:grid-cols-3 gap-6 items-start">
        {/* Create Project Card */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-[var(--card-foreground)]">New Project</h2>
          <form onSubmit={handleCreateProject} className="space-y-3">
            <input
              type="text"
              placeholder="Project name..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none"
              required
            />
            <button
              type="submit"
              disabled={creating}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Plus size={16} />
              {creating ? "Creating..." : "Create Project"}
            </button>
          </form>
        </div>

        {/* Existing Projects List */}
        <div className="md:col-span-2 space-y-4">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">
              {error}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center text-[var(--muted-foreground)]">
              No projects created yet. Use the card to get started!
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/dashboard/kanban/${project.id}`}
                  className="group relative flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm transition-all hover:border-[var(--accent)] hover:shadow-md"
                >
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-[var(--card-foreground)] group-hover:text-[var(--accent)] transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Created on {new Date(project.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-6 border-t border-[var(--border)] pt-3">
                    <button
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="rounded p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                      title="Delete project"
                    >
                      <Trash2 size={15} />
                    </button>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">
                      Open Board <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
