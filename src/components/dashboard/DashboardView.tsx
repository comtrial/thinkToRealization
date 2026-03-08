'use client'

import { useEffect, useState, useCallback } from 'react'
import { IssueListSection } from './IssueListSection'
import { EmptyState } from '@/components/shared/EmptyState'
import { useUIStore } from '@/stores/ui-store'
import { useCanvasStore } from '@/stores/canvas-store'
import type { DashboardResponse } from '@/lib/types/api'

function IssueListSkeleton() {
  const RowSkeleton = () => (
    <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border/30">
      <div className="w-3.5 h-3.5 animate-shimmer rounded" />
      <div className="w-[52px] h-3.5 animate-shimmer rounded" />
      <div className="w-3.5 h-3.5 animate-shimmer rounded-full" />
      <div className="h-3.5 flex-1 max-w-[300px] animate-shimmer rounded" />
      <div className="w-12 h-4 animate-shimmer rounded-badge" />
      <div className="w-[60px] h-3.5 animate-shimmer rounded" />
    </div>
  )

  return (
    <div className="flex flex-col">
      {[0, 1].map((s) => (
        <div key={s}>
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border">
            <div className="w-3 h-3 animate-shimmer rounded" />
            <div className="w-3.5 h-3.5 animate-shimmer rounded-full" />
            <div className="w-20 h-3.5 animate-shimmer rounded" />
            <div className="w-4 h-3.5 animate-shimmer rounded" />
          </div>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ))}
    </div>
  )
}

export function DashboardView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/dashboard`)
      if (res.ok) {
        const json = await res.json()
        setData(json.data)
      } else {
        const body = await res.json().catch(() => null)
        const msg = body?.error?.message || `HTTP ${res.status}`
        console.error('Dashboard API error:', res.status, body)
        setError(msg)
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err)
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    setData(null)
    setError(null)
    fetchDashboard()
  }, [fetchDashboard])

  // Refetch dashboard when switching TO dashboard tab or when data is invalidated
  const activeTab = useUIStore((s) => s.activeTab)
  const dashboardVersion = useUIStore((s) => s.dashboardVersion)

  useEffect(() => {
    if (activeTab === 'dashboard' && projectId) {
      fetchDashboard()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dashboardVersion])


  const handleCreateNode = useCallback(async () => {
    if (!projectId) return
    try {
      const res = await fetch(`/api/projects/${projectId}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'feature',
          title: '새 기능개발',
          canvasX: Math.random() * 300 + 100,
          canvasY: Math.random() * 300 + 100,
        }),
      })
      if (res.ok) {
        const { data: newNode } = await res.json()
        // Add to canvas store
        useCanvasStore.getState().addNode({
          id: newNode.id,
          type: 'baseNode',
          position: { x: newNode.canvasX, y: newNode.canvasY },
          data: newNode,
        })
        // Refetch dashboard
        fetchDashboard()
      }
    } catch (err) {
      console.error('Failed to create node:', err)
    }
  }, [projectId, fetchDashboard])

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <IssueListSkeleton />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-body text-text-secondary mb-2">대시보드를 불러올 수 없습니다</p>
            {error && <p className="text-caption text-text-tertiary mb-md">{error}</p>}
            <button
              onClick={fetchDashboard}
              className="px-4 py-2 rounded-button text-body text-accent border border-accent hover:bg-accent-light transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isEmpty =
    data.inProgress.length === 0 &&
    data.todo.length === 0 &&
    (data.backlog?.length ?? 0) === 0 &&
    data.recentDone.length === 0

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState variant="empty-dashboard" onAction={handleCreateNode} />
        ) : (
          <div className="flex flex-col">
            {data.inProgress.length > 0 && (
              <IssueListSection status="in_progress" label="In Progress" nodes={data.inProgress} defaultOpen={true} onAddNode={handleCreateNode} />
            )}
            {data.todo.length > 0 && (
              <IssueListSection status="todo" label="Todo" nodes={data.todo} defaultOpen={true} onAddNode={handleCreateNode} />
            )}
            {(data.backlog?.length ?? 0) > 0 && (
              <IssueListSection status="backlog" label="Backlog" nodes={data.backlog} defaultOpen={true} onAddNode={handleCreateNode} />
            )}
            {data.recentDone.length > 0 && (
              <IssueListSection status="done" label="Done" nodes={data.recentDone} defaultOpen={false} onAddNode={handleCreateNode} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
