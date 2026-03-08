'use client'

import { BaseEdge, getBezierPath, getSmoothStepPath, EdgeLabelRenderer } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import type { EdgeType } from '@/lib/types/api'

const edgeStyles: Record<string, { stroke: string; strokeWidth: number; strokeDasharray?: string }> = {
  parent_child: { stroke: 'var(--color-accent)', strokeWidth: 2 },
  related: { stroke: 'var(--color-border-hover)', strokeWidth: 1.5, strokeDasharray: '6 3' },
  // Legacy types (backward compat)
  sequence: { stroke: 'var(--color-border-hover)', strokeWidth: 2 },
  dependency: { stroke: 'var(--color-border-hover)', strokeWidth: 2, strokeDasharray: '6 3' },
  regression: { stroke: '#F87171', strokeWidth: 2 },
  branch: { stroke: 'var(--color-border-hover)', strokeWidth: 1.5 },
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  parent_child: '상위-하위',
  related: '연관',
}

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  const edgeType = (data?.type as EdgeType) || 'parent_child'
  const label = data?.label as string | undefined
  const style = edgeStyles[edgeType] || edgeStyles.parent_child

  const pathFn = edgeType === 'branch' ? getSmoothStepPath : getBezierPath
  const [edgePath, labelX, labelY] = pathFn({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const displayLabel = label || RELATIONSHIP_LABELS[edgeType]

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? '#4F46E5' : style.stroke,
          strokeWidth: selected ? 3 : style.strokeWidth,
          strokeDasharray: style.strokeDasharray,
        }}
      />
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="text-badge text-text-tertiary bg-background px-1.5 py-0.5 rounded-badge border border-border"
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
