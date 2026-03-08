'use client'

import { cn } from '@/lib/utils'
import { Inbox, MousePointerClick, LayoutDashboard, Terminal } from 'lucide-react'

type EmptyVariant = 'no-project' | 'empty-dashboard' | 'empty-canvas' | 'no-sessions'

const variants: Record<EmptyVariant, { icon: React.ReactNode; message: string; hint?: string; actionLabel?: string }> = {
  'no-project': {
    icon: <Inbox size={48} className="text-text-tertiary/60" />,
    message: '사이드바에서 프로젝트를 선택하세요',
  },
  'empty-dashboard': {
    icon: <LayoutDashboard size={44} className="text-accent/40" />,
    message: '아직 진행 중인 작업이 없습니다',
    hint: '캔버스에서 노드를 만들어 시작하세요',
    actionLabel: '캔버스로 이동',
  },
  'empty-canvas': {
    icon: <MousePointerClick size={44} className="text-accent/40" />,
    message: '캔버스가 비어있습니다',
    hint: '우클릭으로 첫 노드를 추가하세요',
    actionLabel: '새 노드 만들기',
  },
  'no-sessions': {
    icon: <Terminal size={44} className="text-text-tertiary/50" />,
    message: '세션이 없습니다',
    hint: '새 세션을 시작하여 작업을 기록하세요',
  },
}

interface EmptyStateProps {
  variant: EmptyVariant
  className?: string
  onAction?: () => void
}

export function EmptyState({ variant, className, onAction }: EmptyStateProps) {
  const config = variants[variant]
  return (
    <div data-testid={`empty-${variant}`} className={cn('flex flex-col items-center justify-center py-3xl gap-md text-center', className)}>
      {config.icon}
      <p className="text-body text-text-secondary">{config.message}</p>
      {config.hint && (
        <p className="text-caption text-text-tertiary">{config.hint}</p>
      )}
      {config.actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-2 px-4 py-2 text-caption text-accent border border-accent/30 rounded-button hover:bg-accent-light transition-colors"
        >
          {config.actionLabel}
        </button>
      )}
    </div>
  )
}
