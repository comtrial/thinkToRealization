"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/shared/app-header";
import { PipelineBar } from "@/components/workspace/pipeline-bar";
import { StagePanel } from "@/components/workspace/stage-panel";
import { StageTransitionModal } from "@/components/workspace/stage-transition-modal";
import { CLIPanel } from "@/components/terminal/cli-panel";
import { SessionHistory } from "@/components/terminal/session-history";
import { TimelineBar } from "@/components/timeline/timeline-bar";
import { PinToast } from "@/components/shared/pin-toast";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { useProjectStore } from "@/stores/project-store";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { api } from "@/lib/api-client";
import type { Decision, Activity } from "@/types";

export default function WorkspacePage() {
  const params = useParams();
  const projectId = params.id as string;

  const {
    project,
    stages,
    activeStageId,
    isLoading,
    fetchProject,
    setActiveStage,
    transitionToNextStage,
  } = useProjectStore();

  const { sessions, activeSessionId, createSession, isLiveSession } = useSessionStore();
  const { isFocusMode, toggleFocusMode } = useUIStore();

  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [showPinToast, setShowPinToast] = useState(false);
  const [mobileTab, setMobileTab] = useState<"pipeline" | "terminal">("terminal");

  useEffect(() => {
    fetchProject(projectId);
  }, [projectId, fetchProject]);

  // Fetch decisions for active stage
  useEffect(() => {
    if (!activeStageId) return;
    const activeStage = stages.find((s) => s.id === activeStageId);
    setDecisions(activeStage?.decisions ?? []);
  }, [activeStageId, stages]);

  // Fetch activities
  useEffect(() => {
    if (!projectId) return;
    api<Activity[]>(`/api/activities?projectId=${projectId}`).then((result) => {
      if (result.ok) setActivities(result.data);
    });
  }, [projectId]);

  const activeStage = useMemo(
    () => stages.find((s) => s.id === activeStageId) ?? null,
    [stages, activeStageId]
  );

  const currentIndex = stages.findIndex((s) => s.id === activeStageId);

  const handleNextStage = useCallback(() => {
    if (currentIndex < stages.length - 1) {
      setShowTransitionModal(true);
    }
  }, [currentIndex, stages.length]);

  const handlePrevStage = useCallback(() => {
    if (currentIndex > 0) {
      setActiveStage(stages[currentIndex - 1].id);
    }
  }, [currentIndex, stages, setActiveStage]);

  const handlePin = useCallback(async () => {
    if (!activeStageId || !activeSessionId) return;
    const content = window.prompt("결정사항을 입력하세요:");
    if (!content?.trim()) return;

    const result = await api<Decision>("/api/decisions", {
      method: "POST",
      body: JSON.stringify({
        stageId: activeStageId,
        sessionId: activeSessionId,
        content: content.trim(),
      }),
    });

    if (result.ok) {
      setDecisions((prev) => [...prev, result.data]);
      setShowPinToast(true);
    }
  }, [activeStageId, activeSessionId]);

  const handleDeleteDecision = useCallback(async (id: string) => {
    const result = await api(`/api/decisions/${id}`, { method: "DELETE" });
    if (result.ok) {
      setDecisions((prev) => prev.filter((d) => d.id !== id));
    }
  }, []);

  const handleNewSession = useCallback(() => {
    if (activeStageId) createSession(activeStageId);
  }, [activeStageId, createSession]);

  useKeyboardShortcuts({
    onPin: handlePin,
    onToggleFocusMode: toggleFocusMode,
    onNewSession: handleNewSession,
    onNextStage: handleNextStage,
    onPrevStage: handlePrevStage,
  });

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const sessionIdx = sessions.findIndex((s) => s.id === activeSessionId);
  const sessionName = activeSession?.title ?? `세션 #${sessions.length - sessionIdx}`;
  const isLive = activeSessionId ? isLiveSession(activeSessionId) : false;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <AppHeader projectName={project?.name} showBack />

      <PipelineBar
        stages={stages}
        activeStageId={activeStageId}
        onStageClick={setActiveStage}
      />

      {/* Mobile tabs - hidden on md+ */}
      <div className="flex border-b border-border md:hidden">
        <button
          onClick={() => setMobileTab("pipeline")}
          className={cn(
            "flex-1 py-2 text-sm font-medium",
            mobileTab === "pipeline"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground"
          )}
        >
          단계 정보
        </button>
        <button
          onClick={() => setMobileTab("terminal")}
          className={cn(
            "flex-1 py-2 text-sm font-medium",
            mobileTab === "terminal"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground"
          )}
        >
          터미널
        </button>
      </div>

      {/* Mobile: tab-based view */}
      <div className="flex flex-1 flex-col md:hidden min-h-0">
        <PinToast show={showPinToast} onHide={() => setShowPinToast(false)} />
        {mobileTab === "pipeline" ? (
          <StagePanel
            stage={activeStage}
            decisions={decisions}
            onPrevStage={handlePrevStage}
            onNextStage={handleNextStage}
            hasPrev={currentIndex > 0}
            hasNext={currentIndex < stages.length - 1}
            onDeleteDecision={handleDeleteDecision}
          />
        ) : isLive ? (
          <CLIPanel
            sessionId={activeSessionId}
            sessionName={sessionName}
            onPin={handlePin}
            onExpand={toggleFocusMode}
          />
        ) : activeSessionId ? (
          <div className="flex h-full flex-col">
            <div className="flex h-10 items-center justify-between border-b border-border px-3">
              <span className="text-xs font-medium text-muted-foreground">
                {sessionName} (읽기 전용)
              </span>
            </div>
            <SessionHistory sessionId={activeSessionId} />
          </div>
        ) : (
          <CLIPanel
            sessionId={null}
            sessionName={sessionName}
            onPin={handlePin}
            onExpand={toggleFocusMode}
          />
        )}
      </div>

      {/* Desktop: resizable split */}
      <div className="hidden md:flex flex-1 min-h-0 relative" {...(isFocusMode ? { "data-testid": "focus-mode-active" } : {})}>
        <PinToast show={showPinToast} onHide={() => setShowPinToast(false)} />

        <ResizablePanelGroup direction="horizontal">
          {!isFocusMode && (
            <>
              <ResizablePanel defaultSize={30} minSize={20} maxSize={45}>
                <StagePanel
                  stage={activeStage}
                  decisions={decisions}
                  onPrevStage={handlePrevStage}
                  onNextStage={handleNextStage}
                  hasPrev={currentIndex > 0}
                  hasNext={currentIndex < stages.length - 1}
                  onDeleteDecision={handleDeleteDecision}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          <ResizablePanel defaultSize={isFocusMode ? 100 : 70}>
            {isLive ? (
              <CLIPanel
                sessionId={activeSessionId}
                sessionName={sessionName}
                onPin={handlePin}
                onExpand={toggleFocusMode}
              />
            ) : activeSessionId ? (
              <div className="flex h-full flex-col">
                <div className="flex h-10 items-center justify-between border-b border-border px-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    {sessionName} (읽기 전용)
                  </span>
                </div>
                <SessionHistory sessionId={activeSessionId} />
              </div>
            ) : (
              <CLIPanel
                sessionId={null}
                sessionName={sessionName}
                onPin={handlePin}
                onExpand={toggleFocusMode}
              />
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <TimelineBar activities={activities} />

      {showTransitionModal && activeStage && currentIndex < stages.length - 1 && (
        <StageTransitionModal
          open={showTransitionModal}
          onOpenChange={setShowTransitionModal}
          currentStage={activeStage}
          nextStage={stages[currentIndex + 1]}
          decisions={decisions}
          onTransition={(summary) => {
            transitionToNextStage(summary);
          }}
        />
      )}
    </div>
  );
}
