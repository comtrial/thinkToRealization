'use client'

import { Lightbulb, Code2, Bug, type LucideIcon } from 'lucide-react'
import type { NodeType } from '@/lib/types/api'

const iconMap: Record<NodeType, LucideIcon> = {
  planning: Lightbulb,
  feature: Code2,
  issue: Bug,
}

const colorMap: Record<NodeType, string> = {
  planning: 'text-type-idea',
  feature: 'text-type-task',
  issue: 'text-type-issue',
}

export function NodeTypeIcon({ type, size = 16 }: { type: NodeType; size?: number }) {
  const Icon = iconMap[type]
  return <Icon size={size} className={colorMap[type]} />
}
