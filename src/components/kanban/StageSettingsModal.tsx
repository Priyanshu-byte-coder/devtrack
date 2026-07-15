"use client";

import { useState } from "react";
import { X, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface StageSettingsModalProps {
  stages: Stage[];
  onClose: () => void;
  onSave: (stages: Stage[], deleteStageId?: string) => Promise<void>;
}

const COLOR_PRESETS = [
  "#6366f1", // Indigo
  "#f59e0b", // Amber/Yellow
  "#10b981", // Emerald/Green
  "#ef4444", // Red
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#14b8a6", // Teal
];

export default function StageSettingsModal({ stages, onClose, onSave }: StageSettingsModalProps) {
  const [localStages, setLocalStages] = useState<Stage[]>(
    [...stages].sort((a, b) => a.position - b.position)
  );
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState(COLOR_PRESETS[0]);
  const [saving, setSaving] = useState(false);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const handleAddStage = () => {
    const trimmed = newStageName.trim();
    if (!trimmed) return;

    const newStage: Stage = {
      id: `temp-${Date.now()}`,
      name: trimmed,
      color: newStageColor,
      position: localStages.length,
    };

    setLocalStages([...localStages, newStage]);
    setNewStageName("");
  };

  const handleDeleteStage = (id: string) => {
    if (localStages.length <= 1) {
      alert("At least one stage is required.");
      return;
    }
    const filtered = localStages.filter((s) => s.id !== id);
    // Re-adjust positions
    const adjusted = filtered.map((s, idx) => ({ ...s, position: idx }));
    setLocalStages(adjusted);

    if (!id.startsWith("temp-")) {
      setDeletedIds([...deletedIds, id]);
    }
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === localStages.length - 1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    const result = [...localStages];
    const [removed] = result.splice(index, 1);
    result.splice(newIndex, 0, removed);

    const reindexed = result.map((s, idx) => ({ ...s, position: idx }));
    setLocalStages(reindexed);
  };

  const handleRename = (id: string, name: string) => {
    setLocalStages(localStages.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const handleColorChange = (id: string, color: string) => {
    setLocalStages(localStages.map((s) => (s.id === id ? { ...s, color } : s)));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // First delete removed stages
      for (const deleteId of deletedIds) {
        await onSave([], deleteId);
      }
      // Save all existing and new stages
      await onSave(localStages);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save stages configuration.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <h3 className="text-lg font-semibold text-[var(--card-foreground)]">
            Manage Stages
          </h3>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X size={18} />
          </button>
        </div>

        {/* Existing / Pending list */}
        <div className="my-4 max-h-[300px] overflow-y-auto space-y-3 pr-1">
          {localStages.map((stage, idx) => (
            <div
              key={stage.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--control)] p-3"
            >
              <div className="flex flex-col gap-1">
                <button
                  disabled={idx === 0}
                  onClick={() => handleMove(idx, "up")}
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  disabled={idx === localStages.length - 1}
                  onClick={() => handleMove(idx, "down")}
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
              </div>

              <input
                type="text"
                value={stage.name}
                onChange={(e) => handleRename(stage.id, e.target.value)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none"
              />

              {/* Color Preset Picker */}
              <div className="flex items-center gap-1">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(stage.id, color)}
                    className={`w-4 h-4 rounded-full border transition-all ${
                      stage.color === color ? "border-[var(--foreground)] scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <button
                onClick={() => handleDeleteStage(stage.id)}
                className="rounded p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Add Stage Form */}
        <div className="border-t border-[var(--border)] pt-4 mt-4">
          <h4 className="text-sm font-semibold mb-2 text-[var(--card-foreground)]">Add New Stage</h4>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. QA, Design Review..."
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none"
              />
              <button
                onClick={handleAddStage}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                <Plus size={16} /> Add
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--muted-foreground)] mr-2">Color:</span>
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewStageColor(color)}
                  className={`w-5 h-5 rounded-full border transition-all ${
                    newStageColor === color ? "border-[var(--foreground)] scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4 mt-6">
          <button
            onClick={onClose}
            className="secondary-button rounded-lg px-4 py-2 text-sm font-medium"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
