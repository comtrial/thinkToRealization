'use client'

import { AppShell } from '@/components/layout/AppShell'
import { useUIStore } from '@/stores/ui-store'
import { useProject } from '@/components/providers/ProjectProvider'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { CanvasView } from '@/components/canvas/CanvasView'
import { ReactFlowProvider } from '@xyflow/react'

function MainContent() {
  const activeTab = useUIStore((s) => s.activeTab)
  const { currentProject } = useProject()

  if (!currentProject) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-page-title text-text-primary mb-2">DevFlow</h1>
          <p className="text-body text-text-secondary">
            사이드바에서 프로젝트를 선택하세요
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full">
      {activeTab === 'dashboard' ? (
        <DashboardView projectId={currentProject.id} />
      ) : (
        <ReactFlowProvider>
          <CanvasView projectId={currentProject.id} />
        </ReactFlowProvider>
      )}
    </div>
  )
}

export default function Home() {
  return (
    <AppShell>
      <MainContent />
    </AppShell>
  )
}
