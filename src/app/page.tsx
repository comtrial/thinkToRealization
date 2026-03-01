'use client'

import { AppShell } from '@/components/layout/AppShell'
import { useUIStore } from '@/stores/ui-store'

function MainContent() {
  const activeTab = useUIStore((s) => s.activeTab)

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-page-title text-text-primary mb-2">
          {activeTab === 'dashboard' ? '대시보드' : '캔버스'}
        </h1>
        <p className="text-body text-text-secondary">
          {activeTab === 'dashboard'
            ? '진행 중인 작업을 확인하세요'
            : '프로젝트의 사고 흐름을 시각화하세요'}
        </p>
      </div>
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
