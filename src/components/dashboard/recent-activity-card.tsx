"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { ArrowRight, MapPin, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ProjectWithProgress } from "@/types";

interface RecentActivityCardProps {
  project: ProjectWithProgress | null;
}

export function RecentActivityCard({ project }: RecentActivityCardProps) {
  if (!project) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">
            아직 활동 기록이 없습니다. 새 프로젝트를 시작해보세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(project.updatedAt), {
    addSuffix: true,
    locale: ko,
  });

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-semibold">{project.name}</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                &quot;{project.currentStage?.name}&quot; 단계에서 작업 중단
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                마지막: {timeAgo}
              </span>
              {project.lastDecision && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-amber-400" />
                  최근 결정: &quot;{project.lastDecision.content}&quot;
                </span>
              )}
            </div>
          </div>
          <Link href={`/project/${project.id}`} className="flex-shrink-0">
            <Button size="sm" className="gap-1 w-full md:w-auto">
              이어서 작업 <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
