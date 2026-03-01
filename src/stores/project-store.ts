"use client";

import { create } from "zustand";
import { api } from "@/lib/api-client";
import type { Project, Stage, StageStatus } from "@/types";

interface ProjectState {
  project: Project | null;
  stages: Stage[];
  activeStageId: string | null;
  isLoading: boolean;

  fetchProject: (id: string) => Promise<void>;
  setActiveStage: (id: string) => void;
  updateStageStatus: (id: string, status: StageStatus) => void;
  transitionToNextStage: (summary?: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  stages: [],
  activeStageId: null,
  isLoading: false,

  fetchProject: async (id: string) => {
    set({ isLoading: true });
    const result = await api<Project & { stages: Stage[] }>(
      `/api/projects/${id}`
    );
    if (result.ok) {
      const stages = result.data.stages ?? [];
      const activeStage = stages.find((s) => s.status === "active");
      set({
        project: result.data,
        stages,
        activeStageId: activeStage?.id ?? stages[0]?.id ?? null,
        isLoading: false,
      });
    } else {
      set({ isLoading: false });
    }
  },

  setActiveStage: (id: string) => {
    set({ activeStageId: id });
  },

  updateStageStatus: (id: string, status: StageStatus) => {
    set((state) => ({
      stages: state.stages.map((s) =>
        s.id === id ? { ...s, status } : s
      ),
    }));
  },

  transitionToNextStage: async (summary?: string) => {
    const { stages, activeStageId } = get();
    const currentIndex = stages.findIndex((s) => s.id === activeStageId);
    if (currentIndex === -1 || currentIndex >= stages.length - 1) return;

    const currentStage = stages[currentIndex];
    const nextStage = stages[currentIndex + 1];

    const result = await api(`/api/stages/${currentStage.id}/transition`, {
      method: "POST",
      body: JSON.stringify({ direction: "next", summary }),
    });

    if (result.ok) {
      set((state) => ({
        stages: state.stages.map((s) => {
          if (s.id === currentStage.id)
            return { ...s, status: "completed" as StageStatus, summary: summary ?? s.summary };
          if (s.id === nextStage.id)
            return { ...s, status: "active" as StageStatus };
          return s;
        }),
        activeStageId: nextStage.id,
      }));
    }
  },
}));
