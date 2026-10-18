"use client";

import { buttonVariants } from "@/components/ui/button";
import React, { useState } from "react";
import {
  Brain,
  Layout,
  Server,
  Layers,
  Settings,
  BarChart3,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TargetRole } from "@/types/cv-types";

interface RoleCard {
  role: TargetRole;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRESET_ROLES: RoleCard[] = [
  {
    role: "Machine Learning Engineer",
    description:
      "Build models, training pipelines, NLP, and neural network applications.",
    icon: Brain,
  },
  {
    role: "Frontend Developer",
    description:
      "Create beautiful, responsive user interfaces and interactive web apps.",
    icon: Layout,
  },
  {
    role: "Backend Developer",
    description:
      "Design scalable APIs, microservices, databases, and auth layers.",
    icon: Server,
  },
  {
    role: "Full Stack Developer",
    description: "Handle both client-side and server-side engineering.",
    icon: Layers,
  },
  {
    role: "DevOps Engineer",
    description:
      "Manage infrastructure, CI/CD pipelines, containerization, and cloud.",
    icon: Settings,
  },
  {
    role: "Data Analyst",
    description:
      "Extract insights, perform statistical analysis, and build dashboards.",
    icon: BarChart3,
  },
];

interface RoleSelectorProps {
  selectedRole: TargetRole | null;
  onRoleSelect: (role: TargetRole) => void;
  disabled?: boolean;
}

export default function RoleSelector({
  selectedRole,
  onRoleSelect,
  disabled = false,
}: RoleSelectorProps) {
  const [customRoleText, setCustomRoleText] = useState("");
  const [isCustomSelected, setIsCustomSelected] = useState(false);

  const isPreset = (role: TargetRole | null): boolean => {
    if (!role) return false;
    return PRESET_ROLES.some((r) => r.role === role);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customRoleText.trim()) {
      onRoleSelect(customRoleText.trim());
      setIsCustomSelected(true);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {PRESET_ROLES.map((preset) => {
          const isSelected = selectedRole === preset.role;
          const Icon = preset.icon;

          return (
            <button
              key={preset.role}
              type="button"
              disabled={disabled}
              onClick={() => {
                onRoleSelect(preset.role);
                setIsCustomSelected(false);
              }}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                "bg-[var(--card)] disabled:pointer-events-none disabled:opacity-50",
                isSelected
                  ? "border-[var(--accent)] bg-accent/5"
                  : "border-[var(--border)] hover:border-accent/50"
              )}
            >
              <div
                className={cn(
                  "rounded-md border p-1.5",
                  isSelected
                    ? "border-accent/30 bg-accent/15 text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)]"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <h4 className="text-sm font-medium text-[var(--foreground)]">
                  {preset.role}
                </h4>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  {preset.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Role Selector */}
      <div
        className={cn(
          "rounded-lg border bg-[var(--card)] p-3 transition-colors",
          !isPreset(selectedRole) && selectedRole
            ? "border-[var(--accent)] bg-accent/5"
            : "border-[var(--border)]"
        )}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className={cn(
              "rounded-md border p-1.5",
              !isPreset(selectedRole) && selectedRole
                ? "border-accent/30 bg-accent/15 text-[var(--accent)]"
                : "border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)]"
            )}
          >
            <Plus className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-[var(--foreground)]">
              Another role
            </h4>
            <p className="text-xs text-[var(--muted-foreground)]">
              Type any job title to tailor the resume to it.
            </p>
          </div>
        </div>

        <form onSubmit={handleCustomSubmit} className="flex gap-2">
          <input
            type="text"
            disabled={disabled}
            value={customRoleText}
            onChange={(e) => setCustomRoleText(e.target.value)}
            placeholder="e.g. Site Reliability Engineer, SRE, Developer Advocate..."
            className="flex h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-sm text-[var(--foreground)] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !customRoleText.trim()}
            className={buttonVariants({ variant: "outline" })}
          >
            Use role
          </button>
        </form>

        {!isPreset(selectedRole) && selectedRole && (
          <div className="mt-3 text-xs text-[var(--accent)] font-medium">
            Selected: {selectedRole}
          </div>
        )}
      </div>
    </div>
  );
}
