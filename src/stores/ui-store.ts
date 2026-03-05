import { create } from 'zustand'

interface UIStore {
  sidebarOpen: boolean
  toggleSidebar: () => void
  activeTab: 'dashboard' | 'canvas'
  setActiveTab: (tab: 'dashboard' | 'canvas') => void
  panelMode: 'closed' | 'peek' | 'full'
  panelNodeId: string | null
  panelTab: 'overview' | 'sessions' | 'files' | 'plans'
  openPanel: (nodeId: string) => void
  closePanel: () => void
  toggleFullPage: () => void
  setPanelTab: (tab: 'overview' | 'sessions' | 'files' | 'plans') => void
  terminalExpanded: boolean
  terminalHeight: number
  setTerminalExpanded: (expanded: boolean) => void
  setTerminalHeight: (height: number) => void
  commandPaletteOpen: boolean
  toggleCommandPalette: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: typeof window !== 'undefined' && window.innerWidth <= 768 ? false : true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  panelMode: 'closed',
  panelNodeId: null,
  panelTab: 'overview',
  openPanel: (nodeId) => set({ panelMode: 'peek', panelNodeId: nodeId, panelTab: 'overview' }),
  closePanel: () => set({ panelMode: 'closed', panelNodeId: null }),
  toggleFullPage: () => set((s) => ({
    panelMode: s.panelMode === 'full' ? 'peek' : 'full',
  })),
  setPanelTab: (tab) => set({ panelTab: tab }),
  terminalExpanded: false,
  terminalHeight: 300,
  setTerminalExpanded: (expanded) => set({ terminalExpanded: expanded }),
  setTerminalHeight: (height) => set({ terminalHeight: height }),
  commandPaletteOpen: false,
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
}))
