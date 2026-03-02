'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardSection } from './DashboardSection'
import { DashboardSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import type { DashboardResponse } from '@/lib/types/api'

export function DashboardView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchDashboard = useCallback(async () => {
    setError(false)
    try {
      const res = await fetch(`/api/projects/${projectId}/dashboard`)
      if (res.ok) {
        const json = await res.json()
        setData(json.data)
      } else {
        setError(true)
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    setData(null)
    setError(false)
    fetchDashboard()
  }, [fetchDashboard])

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <DashboardSkeleton />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-body text-text-secondary mb-md">대시보드를 불러올 수 없습니다</p>
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 rounded-button text-body text-accent border border-accent hover:bg-accent-light transition-colors"
          >
            다시 시도
          </button>
        </div>
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
          <EmptyState variant="empty-dashboard" />
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
