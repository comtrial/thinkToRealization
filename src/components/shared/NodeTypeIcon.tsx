'use client'

import { Lightbulb, Code2, Bug, CircleDot, type LucideIcon } from 'lucide-react'
import type { NodeType } from '@/lib/types/api'

const iconMap: Record<string, LucideIcon> = {
  planning: Lightbulb,
  feature: Code2,
  issue: Bug,
}

const colorMap: Record<string, string> = {
  planning: 'text-type-idea',
  feature: 'text-type-task',
  issue: 'text-type-issue',
}

export function NodeTypeIcon({ type, size = 16 }: { type: NodeType | string; size?: number }) {
  const Icon = iconMap[type] ?? CircleDot
  return <Icon size={size} className={colorMap[type] ?? 'text-text-tertiary'} />
}
