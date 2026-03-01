'use client'

import { BaseEdge, getBezierPath, getSmoothStepPath, EdgeLabelRenderer } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import type { EdgeType } from '@/lib/types/api'

const edgeStyles: Record<EdgeType, { stroke: string; strokeWidth: number; strokeDasharray?: string }> = {
  sequence: { stroke: '#94A3B8', strokeWidth: 2 },
  dependency: { stroke: '#94A3B8', strokeWidth: 2, strokeDasharray: '6 3' },
  related: { stroke: '#CBD5E1', strokeWidth: 1.5 },
  regression: { stroke: '#F87171', strokeWidth: 2 },
  branch: { stroke: '#94A3B8', strokeWidth: 1.5 },
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
  const edgeType = (data?.type as EdgeType) || 'sequence'
  const label = data?.label as string | undefined
  const style = edgeStyles[edgeType] || edgeStyles.sequence

  const pathFn = edgeType === 'branch' ? getSmoothStepPath : getBezierPath
  const [edgePath, labelX, labelY] = pathFn({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

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
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="text-badge text-text-tertiary bg-background px-1.5 py-0.5 rounded-badge border border-border"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
