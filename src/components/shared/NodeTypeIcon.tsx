'use client'

import { Lightbulb, Zap, Wrench, Bug, Flag, StickyNote, type LucideIcon } from 'lucide-react'
import type { NodeType } from '@/lib/types/api'

const iconMap: Record<NodeType, LucideIcon> = {
  idea: Lightbulb,
  decision: Zap,
  task: Wrench,
  issue: Bug,
  milestone: Flag,
  note: StickyNote,
}

const colorMap: Record<NodeType, string> = {
  idea: 'text-type-idea',
  decision: 'text-type-decision',
  task: 'text-type-task',
  issue: 'text-type-issue',
  milestone: 'text-type-milestone',
  note: 'text-type-note',
}

export function NodeTypeIcon({ type, size = 16 }: { type: NodeType; size?: number }) {
  const Icon = iconMap[type]
  return <Icon size={size} className={colorMap[type]} />
}
