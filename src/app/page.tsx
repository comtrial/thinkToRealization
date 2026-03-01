"use client";

import { useEffect, useState, useCallback } from "react";
import { AppHeader } from "@/components/shared/app-header";
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card";
import { ProjectGrid } from "@/components/dashboard/project-grid";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { api } from "@/lib/api-client";
import type { Project, ProjectWithProgress, Stage } from "@/types";

function toProjectWithProgress(
  project: Project & { stages?: Stage[] }
): ProjectWithProgress {
  const stages = project.stages ?? [];
  const currentStage = stages.find((s) => s.status === "active") ?? stages[0];
  const completedCount = stages.filter((s) => s.status === "completed").length;
  const progress = stages.length > 0 ? (completedCount / stages.length) * 100 : 0;
  const allDecisions = stages.flatMap((s) => s.decisions ?? []);
  const lastDecision = allDecisions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];

  return { ...project, currentStage, progress, lastDecision };
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    const result = await api<(Project & { stages?: Stage[] })[]>("/api/projects");
    if (result.ok) {
      setProjects(result.data.map(toProjectWithProgress));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const recentProject =
    projects.length > 0
      ? [...projects].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0]
      : null;

  const handleProjectCreated = (project: Project) => {
    const pwp = toProjectWithProgress(project as Project & { stages?: Stage[] });
    setProjects((prev) => [pwp, ...prev]);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 p-4 md:p-6 space-y-6 max-w-5xl mx-auto w-full">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-muted-foreground">로딩 중...</p>
          </div>
        ) : (
          <>
            <RecentActivityCard project={recentProject} />
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">
                프로젝트
              </h2>
              <CreateProjectDialog onCreated={handleProjectCreated} />
            </div>
            <ProjectGrid projects={projects} />
          </>
        )}
      </main>
    </div>
  );
}
