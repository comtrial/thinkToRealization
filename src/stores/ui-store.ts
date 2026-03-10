import { create } from 'zustand'

export type DashboardTab = 'all' | 'assigned' | 'active' | 'backlog'

interface UIStore {
  sidebarOpen: boolean
  toggleSidebar: () => void
  activeTab: 'dashboard' | 'canvas'
  setActiveTab: (tab: 'dashboard' | 'canvas') => void
  dashboardTab: DashboardTab
  setDashboardTab: (tab: DashboardTab) => void
  panelMode: 'closed' | 'peek' | 'full'
  panelNodeId: string | null
  panelTab: 'detail' | 'sessions' | 'plans'
  openPanel: (nodeId: string) => void
  openPanelFull: (nodeId: string) => void
  closePanel: () => void
  toggleFullPage: () => void
  setPanelTab: (tab: 'detail' | 'sessions' | 'plans') => void
  terminalExpanded: boolean
  terminalHeight: number
  setTerminalExpanded: (expanded: boolean) => void
  setTerminalHeight: (height: number) => void
  commandPaletteOpen: boolean
  toggleCommandPalette: () => void
  dashboardVersion: number
  invalidateDashboard: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: typeof window !== 'undefined' && window.innerWidth <= 768 ? false : true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  dashboardTab: 'all',
  setDashboardTab: (tab) => set({ dashboardTab: tab }),
  panelMode: 'closed',
  panelNodeId: null,
  panelTab: 'detail',
  openPanel: (nodeId) => set({ panelMode: 'peek', panelNodeId: nodeId, panelTab: 'detail' }),
  openPanelFull: (nodeId) => set({ panelMode: 'full', panelNodeId: nodeId, panelTab: 'detail' }),
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
  dashboardVersion: 0,
  invalidateDashboard: () => set((s) => ({ dashboardVersion: s.dashboardVersion + 1 })),
}))
