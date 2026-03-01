"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  isFocusMode: boolean;
  isTimelineOpen: boolean;
  stagePanelSize: number;

  toggleFocusMode: () => void;
  toggleTimeline: () => void;
  setStagePanelSize: (size: number) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isFocusMode: false,
      isTimelineOpen: true,
      stagePanelSize: 30,

      toggleFocusMode: () =>
        set((state) => ({ isFocusMode: !state.isFocusMode })),
      toggleTimeline: () =>
        set((state) => ({ isTimelineOpen: !state.isTimelineOpen })),
      setStagePanelSize: (size: number) => set({ stagePanelSize: size }),
    }),
    {
      name: "devflow-ui",
    }
  )
);
