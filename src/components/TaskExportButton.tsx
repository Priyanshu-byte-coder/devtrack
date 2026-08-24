"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Task } from "@/types/project-milestone";

export default function TaskExportButton() {
  const [loading, setLoading] = useState(false);

  const fetchTasks = async (): Promise<Task[]> => {
    const res = await fetch("/api/tasks");
    if (!res.ok) throw new Error("Failed to fetch tasks");
    return res.json();
  };

  const handleExportCSV = async () => {
    try {
      setLoading(true);
      const tasks = await fetchTasks();
      
      const header = ["id", "title", "status", "priority", "due_date", "created_at", "tags"].join(",");
      const rows = tasks.map(t => {
        // Handle special characters in title by wrapping in quotes and escaping internal quotes
        const title = `"${(t.title || "").replace(/"/g, '""')}"`;
        const status = t.status || (t.completed ? "done" : "todo");
        const priority = t.priority || "medium";
        const dueDate = t.dueDate || "";
        // Assume t as any since created_at might be returned from API
        const createdAt = (t as any).created_at || "";
        const tags = `"${(t.tags || []).join(";")}"`;
        
        return [t.id, title, status, priority, dueDate, createdAt, tags].join(",");
      });

      const csvContent = [header, ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `devtrack_tasks_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert("Failed to export tasks to CSV.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setLoading(true);
      const tasks = await fetchTasks();
      
      // Dynamic import to keep bundle size small if not used
      const XLSX = await import("xlsx");
      
      const data = tasks.map(t => ({
        ID: t.id,
        Title: t.title,
        Status: t.status || (t.completed ? "done" : "todo"),
        Priority: t.priority || "medium",
        "Due Date": t.dueDate || "",
        "Created At": (t as any).created_at || "",
        Tags: (t.tags || []).join(", ")
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");
      
      XLSX.writeFile(workbook, `devtrack_tasks_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("Failed to export tasks to Excel.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <button
        onClick={handleExportCSV}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
      >
        <Download size={14} />
        Export CSV
      </button>
      <button
        onClick={handleExportExcel}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 disabled:opacity-50"
      >
        <Download size={14} />
        Export Excel
      </button>
    </div>
  );
}
