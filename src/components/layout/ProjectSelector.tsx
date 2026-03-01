'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'

export function ProjectSelector() {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-1 px-2 py-1 rounded-button text-body text-text-secondary hover:bg-surface-hover transition-colors">
          <span className="truncate max-w-[150px]">프로젝트 선택</span>
          <ChevronDown size={14} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="w-[240px] bg-surface border border-border rounded-dropdown shadow-elevation-2 p-2 z-50"
          sideOffset={4}
          align="start"
        >
          <input
            type="text"
            placeholder="프로젝트 검색..."
            className="w-full px-3 py-2 text-body bg-background border border-border rounded-button focus:outline-none focus:border-accent mb-2"
          />
          <p className="px-3 py-2 text-caption text-text-tertiary">프로젝트가 없습니다</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
