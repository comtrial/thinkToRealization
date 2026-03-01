"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import type { ProjectWithProgress } from "@/types";

interface ProjectCardProps {
  project: ProjectWithProgress;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const stages = project.stages ?? [];
  const timeAgo = formatDistanceToNow(new Date(project.updatedAt), {
    addSuffix: true,
    locale: ko,
  });

  return (
    <Link href={`/project/${project.id}`}>
      <Card className="cursor-pointer transition-colors hover:border-primary/50" data-testid="project-card">
        <CardContent className="p-4 space-y-3 min-h-[100px]">
          <p className="text-sm font-semibold">{project.name}</p>
          <div className="flex items-center gap-1.5" data-testid="project-card-dots">
            {stages.map((stage) => (
              <span
                key={stage.id}
                className={`h-2 w-2 rounded-full ${
                  stage.status === "completed"
                    ? "bg-green-500"
                    : stage.status === "active"
                    ? "bg-blue-500"
                    : "bg-gray-600"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{project.currentStage?.name ?? "대기 중"}</span>
            <span>{timeAgo}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
