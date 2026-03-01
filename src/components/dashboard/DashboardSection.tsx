'use client'

import { DashboardCard } from './DashboardCard'
import type { NodeResponse } from '@/lib/types/api'

interface DashboardSectionProps {
  title: string
  nodes: NodeResponse[]
  variant?: 'default' | 'compact'
}

export function DashboardSection({ title, nodes, variant = 'default' }: DashboardSectionProps) {
  return (
    <section>
      <h2 className="text-section-header text-text-primary mb-md">{title}</h2>
      <div className="flex flex-col gap-sm">
        {nodes.map((node) => (
          <DashboardCard key={node.id} node={node} compact={variant === 'compact'} />
        ))}
      </div>
    </section>
  )
}
