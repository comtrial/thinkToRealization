'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardSection } from './DashboardSection'
import type { DashboardResponse } from '@/lib/types/api'

export function DashboardView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/dashboard`)
      if (res.ok) {
        const json = await res.json()
        setData(json.data)
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-body text-text-secondary">Loading...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-body text-text-secondary">Failed to load dashboard</p>
      </div>
    )
  }

  const isEmpty = data.inProgress.length === 0 && data.todo.length === 0 && data.recentDone.length === 0

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto py-3xl px-xl">
        <h1 className="text-page-title text-text-primary mb-xl">
          돌아왔습니다
        </h1>

        {isEmpty ? (
          <div className="text-center py-3xl">
            <p className="text-body text-text-secondary">
              아직 노드가 없습니다. 캔버스에서 첫 노드를 만들어보세요.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2xl">
            {data.inProgress.length > 0 && (
              <DashboardSection title="작업 중" nodes={data.inProgress} />
            )}
            {data.todo.length > 0 && (
              <DashboardSection title="할 일" nodes={data.todo} />
            )}
            {data.recentDone.length > 0 && (
              <DashboardSection title="최근 완료" nodes={data.recentDone} variant="compact" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
