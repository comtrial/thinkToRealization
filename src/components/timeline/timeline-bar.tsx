"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import type { Activity } from "@/types";

interface TimelineBarProps {
  activities: Activity[];
}

const activityColors: Record<string, string> = {
  session_created: "bg-blue-500",
  decision_created: "bg-amber-400",
  stage_transition: "bg-green-500",
  project_created: "bg-primary",
  idea_addon: "bg-purple-500",
};

export function TimelineBar({ activities }: TimelineBarProps) {
  const { isTimelineOpen, toggleTimeline } = useUIStore();

  return (
    <div className="hidden md:block border-t border-border bg-background safe-area-pb" data-testid="timeline-bar">
      <button
        onClick={toggleTimeline}
        className="flex w-full items-center justify-center py-1 text-muted-foreground hover:bg-muted/50"
      >
        {isTimelineOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        )}
      </button>
      {isTimelineOpen && (
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2.5">
          {activities.length === 0 ? (
            <p className="w-full text-center text-xs text-muted-foreground py-1">
              활동 기록이 없습니다
            </p>
          ) : (
            activities.map((activity) => (
              <Button
                key={activity.id}
                variant="ghost"
                size="icon"
                className="h-3 w-3 p-0 flex-shrink-0"
                title={activity.description ?? activity.activityType}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    activityColors[activity.activityType] ?? "bg-gray-500"
                  }`}
                />
              </Button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
