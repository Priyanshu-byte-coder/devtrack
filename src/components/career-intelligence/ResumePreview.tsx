"use client";

import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Eye, Copy, Check, Info, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResumeContent, ResumeBulletPoint, ProjectDescription, SkillCategory } from "@/types/cv-types";

interface ResumePreviewProps {
  content: ResumeContent;
  onContentChange: (content: ResumeContent) => void;
}

export default function ResumePreview({ content, onContentChange }: ResumePreviewProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopySection = async (sectionName: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionName);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error("Failed to copy section:", err);
    }
  };

  // State update helpers
  const updateSummary = (newSummary: string) => {
    onContentChange({
      ...content,
      professionalSummary: newSummary,
    });
  };

  const updateBulletPoint = (index: number, field: keyof ResumeBulletPoint, value: any) => {
    const newBullets = [...content.bulletPoints];
    newBullets[index] = {
      ...newBullets[index],
      [field]: value,
    };
    onContentChange({
      ...content,
      bulletPoints: newBullets,
    });
  };

  const addBulletPoint = () => {
    const newBullets = [
      ...content.bulletPoints,
      { text: "New achievement bullet point...", repository: "", confidence: 100, technologies: [] },
    ];
    onContentChange({
      ...content,
      bulletPoints: newBullets,
    });
  };

  const deleteBulletPoint = (index: number) => {
    const newBullets = content.bulletPoints.filter((_, idx) => idx !== index);
    onContentChange({
      ...content,
      bulletPoints: newBullets,
    });
  };

  const updateProject = (index: number, field: keyof ProjectDescription, value: any) => {
    const newProjects = [...content.projectDescriptions];
    newProjects[index] = {
      ...newProjects[index],
      [field]: value,
    };
    onContentChange({
      ...content,
      projectDescriptions: newProjects,
    });
  };

  const addProject = () => {
    const newProjects = [
      ...content.projectDescriptions,
      { name: "New Project", nameWithOwner: "owner/repo", url: "https://github.com/", description: "Project description...", highlights: [], technologies: [] },
    ];
    onContentChange({
      ...content,
      projectDescriptions: newProjects,
    });
  };

  const deleteProject = (index: number) => {
    const newProjects = content.projectDescriptions.filter((_, idx) => idx !== index);
    onContentChange({
      ...content,
      projectDescriptions: newProjects,
    });
  };

  const updateSkillCategory = (index: number, field: keyof SkillCategory, value: any) => {
    const newSkills = [...content.skills];
    newSkills[index] = {
      ...newSkills[index],
      [field]: value,
    };
    onContentChange({
      ...content,
      skills: newSkills,
    });
  };

  const addSkillCategory = () => {
    const newSkills = [...content.skills, { category: "New Category", skills: ["Skill 1", "Skill 2"] }];
    onContentChange({
      ...content,
      skills: newSkills,
    });
  };

  const deleteSkillCategory = (index: number) => {
    const newSkills = content.skills.filter((_, idx) => idx !== index);
    onContentChange({
      ...content,
      skills: newSkills,
    });
  };

  const updateSkillSummary = (newSummary: string) => {
    onContentChange({
      ...content,
      skillSummary: newSummary,
    });
  };

  return (
    <div className="space-y-6">
      {/* Controls Header */}
      <div className="flex justify-between items-center bg-[var(--card)] border border-[var(--border)] px-4 py-3 rounded-xl">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-[var(--accent)]" />
          <span className="text-xs text-[var(--muted-foreground)]">
            Tailored to <span className="font-semibold text-[var(--foreground)]">{content.role}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsEditMode(!isEditMode)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-300",
            isEditMode
              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
              : "border-[var(--border)] bg-[var(--card-muted)] hover:bg-[var(--border)]/10 text-[var(--foreground)]"
          )}
        >
          {isEditMode ? (
            <>
              <Eye className="h-3.5 w-3.5" />
              Preview Mode
            </>
          ) : (
            <>
              <Edit2 className="h-3.5 w-3.5" />
              Edit Content
            </>
          )}
        </button>
      </div>

      {/* Main Preview Container */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-xl">
        <Tabs defaultValue="summary" className="w-full">
          <div className="border-b border-[var(--border)] bg-[var(--card-muted)]/50 px-6 pt-2">
            <TabsList className="border-b-0 gap-4">
              <TabsTrigger value="summary" className="py-3 font-semibold text-xs uppercase tracking-wider">
                Professional Summary
              </TabsTrigger>
              <TabsTrigger value="experience" className="py-3 font-semibold text-xs uppercase tracking-wider">
                Experience Bullet Points
              </TabsTrigger>
              <TabsTrigger value="projects" className="py-3 font-semibold text-xs uppercase tracking-wider">
                Project Highlights
              </TabsTrigger>
              <TabsTrigger value="skills" className="py-3 font-semibold text-xs uppercase tracking-wider">
                Skills & Tech
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6">
            {/* TABS CONTENT: SUMMARY */}
            <TabsContent value="summary" className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-[var(--foreground)]">Professional Summary</h4>
                <button
                  type="button"
                  onClick={() => handleCopySection("summary", content.professionalSummary)}
                  className="p-1 rounded hover:bg-[var(--card-muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  title="Copy Section"
                >
                  {copiedSection === "summary" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              {isEditMode ? (
                <Textarea
                  value={content.professionalSummary}
                  onChange={(e) => updateSummary(e.target.value)}
                  className="min-h-[150px] font-sans text-sm leading-relaxed"
                />
              ) : (
                <div className="p-6 rounded-lg border border-[var(--border)]/50 bg-[var(--card-muted)]/20 shadow-inner">
                  <p className="font-sans text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap italic">
                    &ldquo;{content.professionalSummary}&rdquo;
                  </p>
                </div>
              )}
            </TabsContent>

            {/* TABS CONTENT: EXPERIENCE BULLETS */}
            <TabsContent value="experience" className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-[var(--foreground)]">Experience Bullet Points</h4>
                <button
                  type="button"
                  onClick={() =>
                    handleCopySection(
                      "experience",
                      content.bulletPoints.map((bp) => `- ${bp.text}`).join("\n")
                    )
                  }
                  className="p-1 rounded hover:bg-[var(--card-muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  title="Copy All Bullets"
                >
                  {copiedSection === "experience" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <div className="space-y-4">
                {content.bulletPoints.map((bullet, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card-muted)]/25 flex flex-col md:flex-row justify-between gap-4"
                  >
                    <div className="flex-1 space-y-3">
                      {isEditMode ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={bullet.repository}
                            onChange={(e) => updateBulletPoint(idx, "repository", e.target.value)}
                            placeholder="Repository Name"
                            className="flex h-8 w-1/3 rounded-md border border-[var(--border)] bg-[var(--control)] px-3 text-xs text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                          />
                          <Textarea
                            value={bullet.text}
                            onChange={(e) => updateBulletPoint(idx, "text", e.target.value)}
                            className="min-h-[60px] text-xs font-sans"
                            placeholder="Bullet Point Text"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[var(--accent)] uppercase">
                              {bullet.repository || "general contribution"}
                            </span>
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono border border-emerald-500/20">
                              {bullet.confidence}% AI confidence
                            </span>
                          </div>
                          <p className="text-sm text-[var(--foreground)] font-sans leading-relaxed">
                            • {bullet.text}
                          </p>
                        </div>
                      )}

                      {/* Badges for bullet technologies */}
                      <div className="flex flex-wrap gap-1">
                        {bullet.technologies.map((tech) => (
                          <span
                            key={tech}
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>

                    {isEditMode && (
                      <div className="flex md:flex-col justify-end items-center gap-2">
                        <button
                          type="button"
                          onClick={() => deleteBulletPoint(idx)}
                          className="p-2 rounded text-rose-400 hover:bg-rose-500/10"
                          title="Delete Bullet"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {isEditMode && (
                  <button
                    type="button"
                    onClick={addBulletPoint}
                    className="w-full py-2 border border-dashed border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Bullet Point
                  </button>
                )}
              </div>
            </TabsContent>

            {/* TABS CONTENT: PROJECTS */}
            <TabsContent value="projects" className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-[var(--foreground)]">Project Highlights</h4>
                <button
                  type="button"
                  onClick={() =>
                    handleCopySection(
                      "projects",
                      content.projectDescriptions
                        .map(
                          (p) =>
                            `### ${p.name}\n${p.description}\n${p.highlights.map((h) => `- ${h}`).join("\n")}`
                        )
                        .join("\n\n")
                    )
                  }
                  className="p-1 rounded hover:bg-[var(--card-muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  title="Copy All Projects"
                >
                  {copiedSection === "projects" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <div className="space-y-6">
                {content.projectDescriptions.map((proj, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-lg border border-[var(--border)] bg-[var(--card-muted)]/20 space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 flex-1">
                        {isEditMode ? (
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={proj.name}
                              onChange={(e) => updateProject(idx, "name", e.target.value)}
                              placeholder="Project Name"
                              className="flex h-8 w-full rounded-md border border-[var(--border)] bg-[var(--control)] px-3 text-xs text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                            />
                            <input
                              type="text"
                              value={proj.url}
                              onChange={(e) => updateProject(idx, "url", e.target.value)}
                              placeholder="Repository URL"
                              className="flex h-8 w-full rounded-md border border-[var(--border)] bg-[var(--control)] px-3 text-xs text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                            />
                          </div>
                        ) : (
                          <a
                            href={proj.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base font-bold text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
                          >
                            {proj.name}
                          </a>
                        )}
                        <p className="text-[10px] text-[var(--muted-foreground)]">{proj.nameWithOwner}</p>
                      </div>

                      {isEditMode && (
                        <button
                          type="button"
                          onClick={() => deleteProject(idx)}
                          className="p-1.5 rounded text-rose-400 hover:bg-rose-500/10"
                          title="Delete Project"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {isEditMode ? (
                        <Textarea
                          value={proj.description}
                          onChange={(e) => updateProject(idx, "description", e.target.value)}
                          className="min-h-[65px] text-xs"
                          placeholder="Project Description"
                        />
                      ) : (
                        <p className="text-sm font-sans text-[var(--foreground)] leading-relaxed">
                          {proj.description}
                        </p>
                      )}

                      <div className="space-y-1.5 pl-4 border-l-2 border-[var(--border)]">
                        {proj.highlights.map((highlight, hIdx) => (
                          <p key={hIdx} className="text-xs text-[var(--muted-foreground)] font-sans">
                            • {highlight}
                          </p>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {proj.technologies.map((tech) => (
                          <span
                            key={tech}
                            className="text-[9px] font-mono px-2 py-0.5 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {isEditMode && (
                  <button
                    type="button"
                    onClick={addProject}
                    className="w-full py-2 border border-dashed border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Project
                  </button>
                )}
              </div>
            </TabsContent>

            {/* TABS CONTENT: SKILLS */}
            <TabsContent value="skills" className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-[var(--foreground)]">Technical Skills & Categories</h4>
                <button
                  type="button"
                  onClick={() =>
                    handleCopySection(
                      "skills",
                      `${content.skillSummary}\n\n` +
                        content.skills
                          .map((c) => `${c.category}: ${c.skills.join(", ")}`)
                          .join("\n")
                    )
                  }
                  className="p-1 rounded hover:bg-[var(--card-muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  title="Copy Skills"
                >
                  {copiedSection === "skills" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <div className="space-y-4">
                {isEditMode ? (
                  <Textarea
                    value={content.skillSummary}
                    onChange={(e) => updateSkillSummary(e.target.value)}
                    className="min-h-[60px] text-xs"
                    placeholder="General Technical Summary"
                  />
                ) : (
                  <p className="text-sm font-sans text-[var(--foreground)] leading-relaxed italic">
                    &ldquo;{content.skillSummary}&rdquo;
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {content.skills.map((cat, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card-muted)]/20 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-3">
                        {isEditMode ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={cat.category}
                              onChange={(e) => updateSkillCategory(idx, "category", e.target.value)}
                              placeholder="Category Title"
                              className="flex h-8 w-full rounded-md border border-[var(--border)] bg-[var(--control)] px-3 text-xs text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] font-semibold"
                            />
                            <input
                              type="text"
                              value={cat.skills.join(", ")}
                              onChange={(e) =>
                                updateSkillCategory(
                                  idx,
                                  "skills",
                                  e.target.value.split(",").map((s) => s.trim())
                                )
                              }
                              placeholder="Skills (comma separated)"
                              className="flex h-8 w-full rounded-md border border-[var(--border)] bg-[var(--control)] px-3 text-xs text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                            />
                          </div>
                        ) : (
                          <>
                            <h5 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
                              {cat.category}
                            </h5>
                            <div className="flex flex-wrap gap-1.5">
                              {cat.skills.map((skill) => (
                                <span
                                  key={skill}
                                  className="text-[10px] font-medium text-[var(--foreground)] px-2 py-0.5 rounded bg-[var(--card)] border border-[var(--border)]"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {isEditMode && (
                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={() => deleteSkillCategory(idx)}
                            className="p-1 rounded text-rose-400 hover:bg-rose-500/10 text-xs flex items-center gap-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Category
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {isEditMode && (
                    <button
                      type="button"
                      onClick={addSkillCategory}
                      className="border border-dashed border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all flex items-center justify-center gap-1.5 min-h-[100px]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Skill Category
                    </button>
                  )}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
