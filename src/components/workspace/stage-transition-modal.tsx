"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Decision, Stage } from "@/types";

interface StageTransitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStage: Stage;
  nextStage: Stage;
  decisions: Decision[];
  onTransition: (summary?: string) => void;
}

export function StageTransitionModal({
  open,
  onOpenChange,
  currentStage,
  nextStage,
  decisions,
  onTransition,
}: StageTransitionModalProps) {
  const autoSummary = decisions.map((d) => `- ${d.content}`).join("\n");
  const [summary, setSummary] = useState(autoSummary);

  const handleSkip = () => {
    onTransition(undefined);
    onOpenChange(false);
  };

  const handleSave = () => {
    onTransition(summary.trim() || undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="transition-modal">
        <DialogHeader>
          <DialogTitle>다음 단계로 이동</DialogTitle>
          <DialogDescription>
            &quot;{currentStage.name}&quot; 단계를 완료하고 &quot;{nextStage.name}&quot;
            단계로 이동합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            단계 요약
          </label>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={5}
            placeholder="이 단계에서의 결정사항과 결과를 요약하세요..."
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleSkip}>
            건너뛰기
          </Button>
          <Button onClick={handleSave}>저장하고 이동</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
