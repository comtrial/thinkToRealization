'use client'

import { cn } from '@/lib/utils'

const priorityConfig: Record<string, { label: string; className: string }> = {
  none: { label: '', className: '' },
  low: { label: 'Low', className: 'bg-gray-100 text-gray-500 border-gray-200' },
  medium: { label: 'Medium', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  high: { label: 'High', className: 'bg-orange-50 text-orange-600 border-orange-200' },
  urgent: { label: 'Urgent', className: 'bg-red-50 text-red-600 border-red-200' },
}

const priorityOrder = ['none', 'low', 'medium', 'high', 'urgent']

interface NodePriorityBadgeProps {
  priority: string
  onChange?: (priority: string) => void
}

export function NodePriorityBadge({ priority, onChange }: NodePriorityBadgeProps) {
  const config = priorityConfig[priority] || priorityConfig.none

  if (priority === 'none' && !onChange) return null

  const handleClick = () => {
    if (!onChange) return
    const currentIndex = priorityOrder.indexOf(priority)
    const nextIndex = (currentIndex + 1) % priorityOrder.length
    onChange(priorityOrder[nextIndex])
  }

  if (priority === 'none') {
    return (
      <button
        onClick={handleClick}
        className="text-caption text-text-tertiary hover:text-text-secondary transition-colors px-1.5 py-0.5"
      >
        우선순위
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-badge text-badge border',
        'transition-colors',
        config.className,
        onChange && 'cursor-pointer hover:opacity-80'
      )}
      disabled={!onChange}
    >
      {config.label}
    </button>
  )
}
