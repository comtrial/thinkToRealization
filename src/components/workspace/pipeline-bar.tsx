"use client";

import { ChevronRight } from "lucide-react";
import { StageNode } from "./stage-node";
import type { Stage } from "@/types";

interface PipelineBarProps {
  stages: Stage[];
  activeStageId: string | null;
  onStageClick: (id: string) => void;
}

export function PipelineBar({ stages, activeStageId, onStageClick }: PipelineBarProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-background px-2 md:px-4 py-2 md:py-2.5 flex-nowrap" data-testid="pipeline-bar">
      {stages.map((stage, index) => (
        <div key={stage.id} className="flex items-center gap-1 flex-shrink-0">
          <StageNode
            name={stage.name}
            status={stage.status}
            isSelected={stage.id === activeStageId}
            onClick={() => onStageClick(stage.id)}
          />
          {index < stages.length - 1 && (
            <ChevronRight
              className={`h-4 w-4 flex-shrink-0 ${
                stage.status === "completed"
                  ? "text-green-500/50"
                  : "text-gray-700"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
