"use client";

import React from "react";

interface BadgeGridProps {
  title: string;
  children: React.ReactNode;
}

export default function BadgeGrid({ title, children }: BadgeGridProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-lg font-bold text-[var(--foreground)] tracking-tight capitalize">
          {title.replace("_", " ")}
        </h3>
        <div className="h-px flex-1 bg-gradient-to-r from-[var(--border)] to-transparent" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}
