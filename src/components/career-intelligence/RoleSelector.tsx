"use client";

import React, { useState } from "react";
import { Brain, Layout, Server, Layers, Settings, BarChart3, Plus } from "lucide-react";
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
    description: "Build models, training pipelines, NLP, and neural network applications.",
    icon: Brain,
  },
  {
    role: "Frontend Developer",
    description: "Create beautiful, responsive user interfaces and interactive web apps.",
    icon: Layout,
  },
  {
    role: "Backend Developer",
    description: "Design scalable APIs, microservices, databases, and auth layers.",
    icon: Server,
  },
  {
    role: "Full Stack Developer",
    description: "Handle both client-side and server-side engineering.",
    icon: Layers,
  },
  {
    role: "DevOps Engineer",
    description: "Manage infrastructure, CI/CD pipelines, containerization, and cloud.",
    icon: Settings,
  },
  {
    role: "Data Analyst",
    description: "Extract insights, perform statistical analysis, and build dashboards.",
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                "flex items-start gap-4 p-5 text-left rounded-xl border transition-all duration-300",
                "bg-[var(--card)] hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:pointer-events-none",
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent)]/5 shadow-[0_0_15px_rgba(var(--accent-rgb),0.15)]"
                  : "border-[var(--border)] hover:border-[var(--accent)]/50"
              )}
            >
              <div
                className={cn(
                  "p-3 rounded-lg border",
                  isSelected
                    ? "border-[var(--accent)]/30 bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)]"
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-[var(--foreground)]">{preset.role}</h4>
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
          "p-5 rounded-xl border bg-[var(--card)] transition-all duration-300",
          !isPreset(selectedRole) && selectedRole
            ? "border-[var(--accent)] bg-[var(--accent)]/5"
            : "border-[var(--border)]"
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "p-2 rounded-lg border",
              !isPreset(selectedRole) && selectedRole
                ? "border-[var(--accent)]/30 bg-[var(--accent)]/15 text-[var(--accent)]"
                : "border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)]"
            )}
          >
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-[var(--foreground)]">Custom Role</h4>
            <p className="text-xs text-[var(--muted-foreground)]">
              Specify a custom job role to tailor your resume contents to.
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
            className="flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--control)] px-3 py-1 text-sm text-[var(--foreground)] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !customRoleText.trim()}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-[var(--accent)] text-[var(--accent-foreground)] h-9 px-4 py-2 hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
          >
            Apply
          </button>
        </form>

        {!isPreset(selectedRole) && selectedRole && (
          <div className="mt-3 text-xs text-[var(--accent)] font-medium">
            Active Custom Role: &quot;{selectedRole}&quot;
          </div>
        )}
      </div>
    </div>
  );
}
