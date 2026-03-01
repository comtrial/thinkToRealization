'use client'

import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useUIStore } from '@/stores/ui-store'

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  return (
    <div
      className="h-screen w-screen overflow-hidden bg-background"
      style={{
        display: 'grid',
        gridTemplateRows: 'var(--header-height) 1fr',
        gridTemplateColumns: `${sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)'} 1fr`,
      }}
    >
      <Header />
      <Sidebar />
      <main className="overflow-hidden relative">
        {children}
      </main>
    </div>
  )
}
