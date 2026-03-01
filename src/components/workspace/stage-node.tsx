"use client";

import { Circle, PlayCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StageStatus } from "@/types";

interface StageNodeProps {
  name: string;
  status: StageStatus;
  isSelected: boolean;
  onClick: () => void;
}

const statusStyles: Record<
  StageStatus,
  { bg: string; border: string; text: string; Icon: typeof Circle }
> = {
  waiting: {
    bg: "bg-gray-800",
    border: "border-gray-700",
    text: "text-gray-500",
    Icon: Circle,
  },
  active: {
    bg: "bg-blue-500/10",
    border: "border-blue-500",
    text: "text-blue-400",
    Icon: PlayCircle,
  },
  completed: {
    bg: "bg-green-500/10",
    border: "border-green-500/50",
    text: "text-green-400",
    Icon: CheckCircle,
  },
};

export function StageNode({ name, status, isSelected, onClick }: StageNodeProps) {
  const style = statusStyles[status];
  const { Icon } = style;

  return (
    <button
      onClick={onClick}
      data-testid="stage-node"
      className={cn(
        "flex items-center gap-1.5 md:gap-2 rounded-lg border px-2 py-1 md:px-3 md:py-2 text-xs font-medium transition-all",
        style.bg,
        style.border,
        style.text,
        isSelected && "ring-2 ring-blue-400/50"
      )}
    >
      <Icon className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
      <span className="whitespace-nowrap">{name}</span>
    </button>
  );
}
