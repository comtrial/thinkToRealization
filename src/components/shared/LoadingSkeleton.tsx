'use client'

import { cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-button bg-surface-hover', className)} />
  )
}

export function DashboardCardSkeleton() {
  return (
    <div className="rounded-node border border-border bg-surface p-lg flex flex-col gap-sm">
      <div className="flex items-center gap-sm">
        <Skeleton className="w-4 h-4 rounded-full" />
        <Skeleton className="h-4 flex-1 max-w-[200px]" />
        <Skeleton className="w-16 h-5 rounded-badge" />
      </div>
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-3xl mx-auto py-3xl px-xl">
      <Skeleton className="h-8 w-40 mb-xl" />
      <div className="flex flex-col gap-2xl">
        <div>
          <Skeleton className="h-5 w-24 mb-md" />
          <div className="flex flex-col gap-sm">
            <DashboardCardSkeleton />
            <DashboardCardSkeleton />
          </div>
        </div>
        <div>
          <Skeleton className="h-5 w-20 mb-md" />
          <div className="flex flex-col gap-sm">
            <DashboardCardSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
}

export function CanvasLoadingSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-md">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-caption text-text-tertiary">캔버스 로딩 중...</p>
      </div>
    </div>
  )
}

export function PanelContentSkeleton() {
  return (
    <div className="p-lg flex flex-col gap-lg">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="mt-lg">
        <Skeleton className="h-5 w-24 mb-md" />
        <div className="flex flex-col gap-sm">
          <Skeleton className="h-16 w-full rounded-node" />
          <Skeleton className="h-16 w-full rounded-node" />
        </div>
      </div>
    </div>
  )
}
