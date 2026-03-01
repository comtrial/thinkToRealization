"use client";

import { useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Pin, Plus, ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import type { Stage, Decision } from "@/types";

interface StagePanelProps {
  stage: Stage | null;
  decisions: Decision[];
  onPrevStage: () => void;
  onNextStage: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onDeleteDecision?: (id: string) => void;
}

const statusLabel: Record<string, string> = {
  waiting: "대기",
  active: "진행 중",
  completed: "완료",
};

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  waiting: "secondary",
  active: "default",
  completed: "outline",
};

export function StagePanel({
  stage,
  decisions,
  onPrevStage,
  onNextStage,
  hasPrev,
  hasNext,
  onDeleteDecision,
}: StagePanelProps) {
  const { sessions, activeSessionId, fetchSessions, createSession, setActiveSession } =
    useSessionStore();

  useEffect(() => {
    if (stage) {
      fetchSessions(stage.id);
    }
  }, [stage, fetchSessions]);

  if (!stage) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">단계를 선택하세요</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="stage-panel">
      {/* Stage header */}
      <div className="flex items-center gap-2 p-4 pb-3">
        <h3 className="text-sm font-semibold">{stage.name}</h3>
        <Badge variant={statusVariant[stage.status]}>
          {statusLabel[stage.status]}
        </Badge>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Decisions */}
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Pin className="h-3 w-3 text-amber-400" />
              결정사항 ({decisions.length})
            </h4>
            {decisions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                아직 결정사항이 없습니다
              </p>
            ) : (
              <ul className="space-y-1.5">
                {decisions.map((d) => (
                  <li
                    key={d.id}
                    className="group flex items-start gap-2 text-xs min-h-[44px] py-1"
                    data-testid="decision-item"
                  >
                    <Pin className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-400" />
                    <span className="flex-1">{d.content}</span>
                    {onDeleteDecision && (
                      <button
                        onClick={() => onDeleteDecision(d.id)}
                        className="hidden flex-shrink-0 text-muted-foreground hover:text-destructive group-hover:block"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />

          {/* Sessions */}
          <div>
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
              세션 ({sessions.length})
            </h4>
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                아직 세션이 없습니다
              </p>
            ) : (
              <ul className="space-y-1">
                {sessions.map((session, idx) => {
                  const isActive = session.id === activeSessionId;
                  const pinCount = session.decisions?.length ?? 0;
                  const timeAgo = formatDistanceToNow(
                    new Date(session.updatedAt),
                    { addSuffix: true, locale: ko }
                  );

                  return (
                    <li key={session.id} data-testid="session-item">
                      <button
                        onClick={() => setActiveSession(session.id)}
                        className={cn(
                          "w-full rounded-md px-2.5 py-2.5 md:py-2 text-left text-xs transition-colors min-h-[44px]",
                          isActive
                            ? "bg-blue-500/10 border border-blue-500/30 text-blue-300"
                            : "hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            #{sessions.length - idx}{" "}
                            {session.title ?? "세션"}
                          </span>
                          <span className="text-muted-foreground">
                            {timeAgo}
                          </span>
                        </div>
                        {pinCount > 0 && (
                          <span className="mt-0.5 flex items-center gap-1 text-amber-400">
                            <Pin className="h-2.5 w-2.5" />
                            {pinCount}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full border-dashed border-gray-700 text-xs"
              onClick={() => stage && createSession(stage.id)}
              data-testid="new-session-btn"
            >
              <Plus className="mr-1 h-3 w-3" />
              새 세션
            </Button>
          </div>
        </div>
      </ScrollArea>

      <Separator />

      {/* Navigation */}
      <div className="flex items-center justify-between p-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasPrev}
          onClick={onPrevStage}
          className="text-xs"
          data-testid="prev-stage-btn"
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          이전
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasNext}
          onClick={onNextStage}
          className="text-xs"
          data-testid="next-stage-btn"
        >
          다음 <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
