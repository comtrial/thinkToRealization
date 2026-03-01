'use client'

import { cn } from '@/lib/utils'
import { Inbox, MousePointerClick, LayoutDashboard, Terminal } from 'lucide-react'

type EmptyVariant = 'no-project' | 'empty-dashboard' | 'empty-canvas' | 'no-sessions'

const variants: Record<EmptyVariant, { icon: React.ReactNode; message: string; hint?: string }> = {
  'no-project': {
    icon: <Inbox size={40} className="text-text-tertiary" />,
    message: '사이드바에서 프로젝트를 선택하세요',
  },
  'empty-dashboard': {
    icon: <LayoutDashboard size={40} className="text-text-tertiary" />,
    message: '아직 진행 중인 작업이 없습니다',
    hint: '캔버스에서 노드를 만들어 시작하세요',
  },
  'empty-canvas': {
    icon: <MousePointerClick size={40} className="text-text-tertiary" />,
    message: '캔버스가 비어있습니다',
    hint: '우클릭으로 첫 노드를 추가하세요',
  },
  'no-sessions': {
    icon: <Terminal size={40} className="text-text-tertiary" />,
    message: '세션이 없습니다',
    hint: '새 세션을 시작하여 작업을 기록하세요',
  },
}

interface EmptyStateProps {
  variant: EmptyVariant
  className?: string
}

export function EmptyState({ variant, className }: EmptyStateProps) {
  const config = variants[variant]
  return (
    <div className={cn('flex flex-col items-center justify-center py-3xl gap-md text-center', className)}>
      {config.icon}
      <p className="text-body text-text-secondary">{config.message}</p>
      {config.hint && (
        <p className="text-caption text-text-tertiary">{config.hint}</p>
      )}
    </div>
  )
}
