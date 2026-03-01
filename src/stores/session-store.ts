"use client";

import { create } from "zustand";
import { api } from "@/lib/api-client";
import type { Session } from "@/types";

interface SessionState {
  activeSessionId: string | null;
  liveSessionId: string | null; // The most recent session with active terminal
  sessions: Session[];
  isLoading: boolean;

  fetchSessions: (stageId: string) => Promise<void>;
  createSession: (stageId: string) => Promise<void>;
  setActiveSession: (id: string) => void;
  isLiveSession: (id: string) => boolean;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSessionId: null,
  liveSessionId: null,
  sessions: [],
  isLoading: false,

  fetchSessions: async (stageId: string) => {
    set({ isLoading: true });
    const result = await api<Session[]>(`/api/stages/${stageId}/sessions`);
    if (result.ok) {
      const sessions = result.data;
      const latestId = sessions[0]?.id ?? null;
      set({
        sessions,
        activeSessionId: latestId,
        liveSessionId: latestId,
        isLoading: false,
      });
    } else {
      set({ isLoading: false });
    }
  },

  createSession: async (stageId: string) => {
    const result = await api<Session>(`/api/stages/${stageId}/sessions`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (result.ok) {
      set((state) => ({
        sessions: [result.data, ...state.sessions],
        activeSessionId: result.data.id,
        liveSessionId: result.data.id,
      }));
    }
  },

  setActiveSession: (id: string) => {
    set({ activeSessionId: id });
  },

  isLiveSession: (id: string) => {
    return get().liveSessionId === id;
  },
}));
