"use client";

import { ProjectCard } from "./project-card";
import type { ProjectWithProgress } from "@/types";

interface ProjectGridProps {
  projects: ProjectWithProgress[];
}

export function ProjectGrid({ projects }: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-12">
        <p className="text-sm text-muted-foreground">
          프로젝트가 없습니다. 새 프로젝트를 만들어보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
